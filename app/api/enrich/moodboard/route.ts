import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  scrapeImages,
  brandRetrieve,
  scrapeStyleguide,
  bareDomain,
  CtxImage,
  CtxStyleguide,
} from "@/lib/contextdev";
import { firecrawlScrape } from "@/lib/firecrawl";
import { openrouterComplete, parseJsonLoose } from "@/lib/openrouter";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Builds a per-buyer visual moodboard from their website:
 *   - image grid    — context.dev /web/scrape/images (the site's own photos)
 *   - brand layer   — context.dev /brand/retrieve (logo, official colors, blurb)
 *   - typography    — context.dev /web/styleguide (real heading/body faces from
 *                     the rendered CSS, with font-file URLs for live samples)
 *   - editorial layer — LLM (OpenRouter) synthesizes a tagline, brand-voice
 *                     keywords, collections/sub-brands and a named 4-color
 *                     palette from the scraped site content. Best-effort: an
 *                     LLM failure never sinks the board.
 *   - screenshot    — Firecrawl full-page capture, fetched only when the image
 *                     grid comes back thin (sites that block headless scraping)
 * Cached in enrichment_cache.moodboard with a 7-day TTL — each build costs
 * real API credits, so it only runs on demand from the dossier.
 */

const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_IMAGES = 12;
const MIN_IMAGES_BEFORE_SCREENSHOT = 4;

/** Bump when the board contract changes — older cache entries rebuild. */
const BOARD_VERSION = 3;

interface EditorialLayer {
  /** Verbatim brand line from the site (never invented); null when none found. */
  quote: { text: string; type: "slogan" | "essence" } | null;
  /** Masthead dateline: market/origin · campaign or season · year. */
  dateline: string | null;
  aesthetic: string | null;
  voiceKeywords: string[];
  /** Own sub-brands, lines and membership programs — licensed names dropped. */
  programs: string[];
  palette: { hex: string; name: string }[];
  /** Short sentence in the brand's voice for the display-type sample. */
  displaySample: string | null;
  /** Curated editorial tags per image index (≤5 words each). */
  imageLabels: Record<string, string>;
}

/** Typography as stored on the board: family + loadable files per face. */
interface TypographyFace {
  name: string | null; // display name, e.g. "Beausite Slick"
  category: string | null; // "serif" | "sans-serif" | null
  files: Record<string, string>; // weight -> font file URL ({} if not loadable)
}

function typographyFromStyleguide(
  sg: CtxStyleguide | null
): { display: TypographyFace; text: TypographyFace } | null {
  if (!sg) return null;
  const face = (family: string | null): TypographyFace => {
    if (!family) return { name: null, category: null, files: {} };
    const link = sg.typography.fontLinks[family];
    return {
      name: link?.displayName ?? family.replace(/[-_]+/g, " "),
      category: link?.category ?? null,
      files: link?.files ?? {},
    };
  };
  const display = face(sg.typography.display.family);
  const text = face(sg.typography.text.family);
  if (!display.name && !text.name) return null;
  return { display, text };
}

/** Drop icons, logos, trackers and non-photographic assets; dedupe; cap. */
function filterImages(images: CtxImage[]): { src: string; alt: string | null }[] {
  const seen = new Set<string>();
  const out: { src: string; alt: string | null }[] = [];
  for (const img of images) {
    const src = (img.src ?? "").trim();
    if (!/^https?:\/\//i.test(src)) continue; // skip data: URIs / inline SVGs
    if (/\.(svg|ico|gif)(\?|$)/i.test(src)) continue;
    if (/(favicon|icon|sprite|logo|badge|pixel|tracking|placeholder|loader|spinner|flag)/i.test(src))
      continue;
    if (seen.has(src)) continue;
    seen.add(src);
    out.push({ src, alt: img.alt?.trim() || null });
    if (out.length >= MAX_IMAGES) break;
  }
  return out;
}

/** Firecrawl full-page screenshot — the always-works visual fallback. */
async function firecrawlScreenshot(url: string): Promise<string | null> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ url, formats: ["screenshot@fullPage"] }),
    });
    const j = await res.json();
    if (!res.ok) return null;
    return (j?.data?.screenshot as string) ?? null;
  } catch {
    return null;
  }
}

const HEX_RE = /^#[0-9a-f]{6}$/i;

/** Loose text normalization for verbatim-quote verification: case, quotes,
 * dashes and whitespace variations must not break a genuine match. */
function normForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’“”'"]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function asStringArray(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((s) => String(s ?? "").trim())
    .filter(Boolean)
    .slice(0, max);
}

/** LLM pass — turn scraped content + brand data into the editorial layer.
 * The rules here implement MOODBOARD.md — change both together. */
async function buildEditorialLayer(input: {
  org: string | null;
  brandDescription: string | null;
  slogan: string | null;
  knownColors: { hex: string; name?: string }[];
  images: { src: string; alt: string | null }[];
  markdown: string | null;
  leadContext: {
    categories: string | null;
    target_audience: string | null;
    country: string | null;
  };
}): Promise<EditorialLayer | null> {
  if (!process.env.OPENROUTER_API_KEY) return null;

  const system =
    "You are a brand analyst preparing an editorial moodboard for a wholesale " +
    "sourcing team. Ground every answer in the provided content — never invent " +
    "facts or quotes. Respond with a single JSON object only — no prose, no code fences.";

  const known = input.knownColors
    .map((c) => (c.name ? `${c.hex} (${c.name})` : c.hex))
    .join(", ");
  const imageList = input.images
    .map((img, i) => `${i}: ${img.alt ?? "(no caption)"}`)
    .join("\n");
  const user = [
    `Brand: ${input.org ?? "Unknown"}`,
    `Current year: ${new Date().getFullYear()}`,
    input.slogan ? `Official slogan: ${input.slogan}` : null,
    input.brandDescription ? `About: ${input.brandDescription}` : null,
    input.leadContext.categories
      ? `Product categories: ${input.leadContext.categories}`
      : null,
    input.leadContext.target_audience
      ? `Target audience: ${input.leadContext.target_audience}`
      : null,
    input.leadContext.country
      ? `Buyer country: ${input.leadContext.country}`
      : null,
    known ? `Known official brand colors: ${known}` : null,
    input.images.length
      ? `Images on the board (index: caption):\n${imageList}`
      : null,
    input.markdown
      ? `Website content (excerpt):\n${input.markdown.slice(0, 6000)}`
      : null,
    "",
    "Return JSON with exactly these keys:",
    `{
  "quote": {"text": "a brand line copied VERBATIM from the 'Website content' excerpt below — hero copy or a brand-essence line written by the brand itself", "type": "slogan or essence"} — null if no such line exists in the excerpt; NEVER compose one yourself and NEVER take it from the About paragraph (that text is third-party),
  "dateline": "market/origin · current campaign or season named in the content · the current year given above — e.g. 'Australian home · High winter · ${new Date().getFullYear()}'; omit parts you cannot ground",
  "aesthetic": "3-5 word phrase describing the visual aesthetic",
  "voice_keywords": ["exactly 5 single-word adjectives matching how the brand actually writes"],
  "programs": ["up to 6 of the brand's OWN sub-brands, lines or membership/loyalty programs named in the content (e.g. 'Linen Lovers — 40% off, early access'); EXCLUDE licensed third-party names like NBA or Disney; [] if none"],
  "palette": [{"hex": "#RRGGBB", "name": "evocative color name"} — exactly 6 colors: official brand colors first, then colors evident in the imagery and current campaign; at most 2 plain neutrals (black/white/grey)],
  "display_sample": "a short sentence in the brand's own voice for a type specimen, taken or adapted from site copy",
  "image_labels": {"<index>": "curated editorial tag, max 5 words, title case — e.g. 'High Winter Campaign'"} — only for indexes where the caption gives you something SPECIFIC to say about that image; every label must be distinct; omit an index rather than repeat a label or write a generic one
}`,
  ]
    .filter((l) => l !== null)
    .join("\n");

  try {
    // Haiku primary (the free Qwen tier was deprecated by OpenRouter);
    // DeepSeek remains the automatic fallback via the standard chain.
    const raw = await openrouterComplete(system, user, {
      model: "anthropic/claude-haiku-4.5",
    });
    const j = parseJsonLoose(raw);

    const palette = (Array.isArray(j.palette) ? j.palette : [])
      .map((p) => ({
        hex: String((p as Record<string, unknown>)?.hex ?? "").trim(),
        name: String((p as Record<string, unknown>)?.name ?? "").trim(),
      }))
      .filter((p) => HEX_RE.test(p.hex))
      .slice(0, 6);

    // MOODBOARD.md §3: the quote must be REAL. Models invent plausible
    // taglines despite instructions, so verify deterministically — keep it
    // only if it appears in the scraped content or equals the slogan.
    const qo = j.quote as Record<string, unknown> | null | undefined;
    const quoteText = String(qo?.text ?? "").trim();
    const corpus = normForMatch(
      `${input.slogan ?? ""}\n${input.markdown ?? ""}`
    );
    const quote =
      quoteText && corpus.includes(normForMatch(quoteText))
        ? {
            text: quoteText,
            type: String(qo?.type ?? "") === "slogan" ? ("slogan" as const) : ("essence" as const),
          }
        : null;

    // §2/§9: labels must be specific and distinct — drop duplicates and
    // labels that are just the brand name.
    const imageLabels: Record<string, string> = {};
    const seenLabels = new Set<string>([normForMatch(input.org ?? "")]);
    if (j.image_labels && typeof j.image_labels === "object") {
      for (const [k, v] of Object.entries(j.image_labels as Record<string, unknown>)) {
        const label = String(v ?? "").trim();
        const norm = normForMatch(label);
        if (!/^\d+$/.test(k) || !label || label.length > 60) continue;
        if (!norm || seenLabels.has(norm)) continue;
        seenLabels.add(norm);
        imageLabels[k] = label;
      }
    }

    return {
      quote,
      dateline: String(j.dateline ?? "").trim() || null,
      aesthetic: String(j.aesthetic ?? "").trim() || null,
      voiceKeywords: asStringArray(j.voice_keywords, 5),
      programs: asStringArray(j.programs, 6),
      palette,
      displaySample: String(j.display_sample ?? "").trim() || null,
      imageLabels,
    };
  } catch {
    return null; // best-effort — the visual board still renders without it
  }
}

export async function POST(req: NextRequest) {
  const { leadId, url, force } = await req.json();
  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }
  const fullUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;

  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("enrichment_cache, organization, categories, target_audience, country")
    .eq("id", leadId)
    .single();

  const cache =
    (lead?.enrichment_cache as Record<string, unknown> | null) ?? {};
  const cached = cache.moodboard as
    | { fetchedAt?: string; version?: number }
    | undefined;
  // Boards from older contract versions rebuild (see BOARD_VERSION).
  if (!force && cached?.fetchedAt && cached.version === BOARD_VERSION) {
    const age = Date.now() - new Date(cached.fetchedAt).getTime();
    if (age < TTL_MS) {
      return NextResponse.json({ cached: true, result: cached });
    }
  }

  try {
    // Images, brand data, styleguide and site content are independent —
    // fetch in parallel; each may fail alone without sinking the board.
    const domain = bareDomain(fullUrl);
    const [imagesRes, brandRes, styleRes, scrapeRes] = await Promise.allSettled([
      scrapeImages(fullUrl),
      brandRetrieve(domain),
      scrapeStyleguide(domain),
      firecrawlScrape(fullUrl),
    ]);

    const images =
      imagesRes.status === "fulfilled" ? filterImages(imagesRes.value) : [];
    const brand = brandRes.status === "fulfilled" ? brandRes.value : null;
    const styleguide = styleRes.status === "fulfilled" ? styleRes.value : null;
    const markdown =
      scrapeRes.status === "fulfilled" ? (scrapeRes.value?.markdown ?? null) : null;

    // The site's working colors strengthen the LLM's palette grounding.
    const knownColors = [
      ...(brand?.colors ?? []),
      ...Object.entries(styleguide?.colors ?? {})
        .filter(([, hex]) => HEX_RE.test(String(hex)))
        .map(([role, hex]) => ({ hex: String(hex), name: `site ${role}` })),
    ];

    const [editorial, screenshot] = await Promise.all([
      buildEditorialLayer({
        org: brand?.title ?? (lead?.organization as string | null) ?? null,
        brandDescription: brand?.description ?? null,
        slogan: brand?.slogan ?? null,
        knownColors,
        images,
        markdown,
        leadContext: {
          categories: (lead?.categories as string | null) ?? null,
          target_audience: (lead?.target_audience as string | null) ?? null,
          country: (lead?.country as string | null) ?? null,
        },
      }),
      images.length < MIN_IMAGES_BEFORE_SCREENSHOT
        ? firecrawlScreenshot(fullUrl)
        : Promise.resolve(null),
    ]);

    if (images.length === 0 && !brand && !screenshot) {
      const reason =
        imagesRes.status === "rejected"
          ? String(imagesRes.reason?.message ?? imagesRes.reason)
          : "The site returned no usable images or brand data.";
      return NextResponse.json({ error: reason }, { status: 502 });
    }

    // Curated labels win over raw alt text (MOODBOARD.md §2). Alt text that
    // is just the brand name says nothing — show no tag instead.
    const orgNorm = normForMatch(
      brand?.title ?? (lead?.organization as string | null) ?? ""
    );
    const labeledImages = images.map((img, i) => {
      const fallback =
        img.alt && orgNorm && normForMatch(img.alt) === orgNorm
          ? null
          : img.alt;
      return { ...img, label: editorial?.imageLabels?.[String(i)] ?? fallback };
    });

    const result = {
      version: BOARD_VERSION,
      brand,
      images: labeledImages,
      screenshot,
      editorial,
      typography: typographyFromStyleguide(styleguide),
      fetchedAt: new Date().toISOString(),
    };

    await supabaseAdmin
      .from("leads")
      .update({ enrichment_cache: { ...cache, moodboard: result } })
      .eq("id", leadId);

    return NextResponse.json({ cached: false, result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Moodboard failed" },
      { status: 500 }
    );
  }
}
