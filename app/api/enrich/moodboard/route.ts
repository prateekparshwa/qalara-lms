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
const BOARD_VERSION = 7;

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
  /** LLM-chosen lead image index (lifestyle/campaign, not promo strips). */
  heroIndex: number | null;
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
  // Category from fontLinks if present, else the CSS generic fallback
  // (custom-hosted fonts have no category but the stack ends in serif/sans).
  const face = (slot: {
    family: string | null;
    generic: string | null;
  }): TypographyFace => {
    if (!slot.family) return { name: null, category: null, files: {} };
    const link = sg.typography.fontLinks[slot.family];
    return {
      name: link?.displayName ?? slot.family.replace(/[-_]+/g, " "),
      category: link?.category ?? slot.generic ?? null,
      files: link?.files ?? {},
    };
  };
  const display = face(sg.typography.display);
  const text = face(sg.typography.text);
  if (!display.name && !text.name) return null;
  return { display, text };
}

/** Asset identity key — responsive variants of the SAME image (desktop/mobile
 * crops, CDN resize prefixes, size suffixes) must collapse to one entry. */
function assetKey(src: string): string {
  return src
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/\/cdn-cgi\/image\/[^/]*/i, "") // Cloudflare resize prefix
    .replace(/\?.*$/, "")
    .replace(/\.[a-z0-9]+$/i, "") // extension (dt/mb crops may differ in format)
    .replace(/[_-](dt|mb|desktop|mobile|sm|md|lg|xl)$/i, "")
    .replace(/@\dx$/i, "")
    .toLowerCase();
}

/** Sale/promo graphics say nothing about the brand's look — product and
 * lifestyle photography must win the board (MOODBOARD.md §2). */
function isPromo(src: string, alt: string | null): boolean {
  const hay = `${src.split("/").pop() ?? ""} ${alt ?? ""}`.toLowerCase();
  return /(sale|promo|clearance|markdown|discount|offer|deal|strip|voucher|coupon|\d{1,2}-?(%|percent|off))/i.test(
    hay
  );
}

/** Drop icons, logos, trackers and non-photographic assets; dedupe exact and
 * responsive-variant repeats (desktop crop preferred); rank photography
 * above promo banners; cap. */
function filterImages(images: CtxImage[]): { src: string; alt: string | null }[] {
  type Entry = { src: string; alt: string | null; kind: string };
  const byKey = new Map<string, Entry>();
  for (const img of images) {
    const src = (img.src ?? "").trim();
    const kind = (img.enrichment?.type ?? "").toLowerCase();
    if (!/^https?:\/\//i.test(src)) continue; // skip data: URIs / inline SVGs
    if (/\.(svg|ico|gif)(\?|$)/i.test(src)) continue;
    // Pixel classification: icons and wordmarks never belong on the board.
    if (kind === "icon" || kind === "wordmark" || kind === "logo") continue;
    if (/(favicon|icon|sprite|logo|badge|pixel|tracking|placeholder|loader|spinner|flag)/i.test(src))
      continue;
    const w = img.enrichment?.width ?? 0;
    const h = img.enrichment?.height ?? 0;
    if (w > 0 && (w < 220 || h < 120)) continue; // thumbnails and strips
    const key = assetKey(src);
    const existing = byKey.get(key);
    const isMobileCrop = /[_-](mb|mobile)(?=\.[a-z]+$)/i.test(src);
    const entry: Entry = { src, alt: img.alt?.trim() || null, kind };
    if (!existing) {
      byKey.set(key, entry);
    } else if (
      // A desktop crop or a photography-classified variant wins the slot.
      (/[_-](mb|mobile)(?=\.[a-z]+$)/i.test(existing.src) && !isMobileCrop) ||
      (kind === "photography" && existing.kind !== "photography")
    ) {
      byKey.set(key, { ...entry, alt: entry.alt || existing.alt });
    }
  }
  const all = Array.from(byKey.values());
  // Rank by what the pixels show: photography → unclassified → other
  // graphics; promo-named assets sink within each band.
  const rank = (e: Entry) =>
    (e.kind === "photography" ? 0 : e.kind === "" ? 10 : 20) +
    (isPromo(e.src, e.alt) ? 5 : 0);
  return all
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, MAX_IMAGES)
    .map(({ src, alt }) => ({ src, alt }));
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

/** HSL saturation (0–1). Near 0 = a neutral (black / white / grey). */
function saturation(hex: string): number {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const l = (max + min) / 2;
  return l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
}

const isNeutral = (hex: string): boolean => saturation(hex) < 0.14;

/**
 * MOODBOARD.md §5: a warm brand must not read greyscale. Keep all chromatic
 * swatches in order; allow at most 2 neutrals (UI chrome tends to be grey),
 * cap at 6.
 */
function capNeutrals(
  palette: { hex: string; name: string }[]
): { hex: string; name: string }[] {
  const out: { hex: string; name: string }[] = [];
  let neutrals = 0;
  for (const c of palette) {
    if (isNeutral(c.hex)) {
      if (neutrals >= 2) continue;
      neutrals++;
    }
    out.push(c);
    if (out.length >= 6) break;
  }
  return out;
}

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
    "facts or quotes. WRITE EVERY VALUE IN ENGLISH: if the brand's content, " +
    "captions, slogans or product names are in another language (Turkish, " +
    "Spanish, etc.), translate them into natural English — never return " +
    "non-English text. Respond with a single JSON object only — no prose, no code fences.";

  const known = input.knownColors
    .map((c) => (c.name ? `${c.hex} (${c.name})` : c.hex))
    .join(", ");
  const imageList = input.images
    .map((img, i) => {
      const file = img.src.split("/").pop()?.split("?")[0] ?? "";
      return `${i}: ${img.alt ?? "(no caption)"} [file: ${file}]`;
    })
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
    known
      ? `Site interface / logo colors (often neutral UI chrome — do NOT just copy these into the palette): ${known}`
      : null,
    input.images.length
      ? `Images on the board (index: caption):\n${imageList}`
      : null,
    input.markdown
      ? `Website content (excerpt):\n${input.markdown.slice(0, 6000)}`
      : null,
    "",
    "Return JSON with exactly these keys:",
    `{
  "essence": "ONE short, evocative sentence (max 12 words) capturing this brand's essence and emotional promise, written IN THE BRAND'S OWN WARM VOICE like a tagline — e.g. 'Welcome home — comfort, luxury and the sheer joy of home living.' Derive the THEME from the website content; do NOT invent facts, numbers or awards, do NOT write a dry corporate descriptor, and do NOT copy a slogan verbatim. Return null if the content is too thin.",
  "dateline": "market/origin · current campaign or season named in the content · the current year given above — e.g. 'Australian home · High winter · ${new Date().getFullYear()}'; omit parts you cannot ground",
  "aesthetic": "3-5 word phrase describing the visual aesthetic",
  "voice_keywords": ["exactly 5 evocative, brand-SPECIFIC single-word adjectives drawn from how this brand actually writes — avoid generic retail words like 'accessible', 'functional', 'quality', 'stylish'; prefer distinctive ones e.g. 'sanctuary', 'curated', 'cosy', 'considered'"],
  "programs": ["up to 6 of the brand's OWN sub-brands, ranges or membership programs as SHORT names only (2-4 words, e.g. 'Linen Lovers', 'Adairs Kids', 'Adairs Insider'); do NOT append descriptions and do NOT name licensed third-party brands (NBA, Disney, etc.); [] if none"],
  "palette": [{"hex": "#RRGGBB", "name": "evocative color name"} — exactly 6 colors capturing the brand's VISUAL MOOD. Derive them from the imagery, product types and seasonal campaign (e.g. a warm home brand → linen, ecru, clay, sage, terracotta, charcoal). Do NOT fill the palette with the interface colors above — include AT MOST 2 neutrals (black/white/grey); the other 4+ must be warm or chromatic tones true to the brand],
  "display_sample": "a short on-brand line for a type specimen — a welcome/essence/lifestyle line in the brand's own voice (e.g. 'Welcome home'); do NOT use a sale, discount or loyalty-promo line",
  "image_labels": {"<index>": "curated editorial tag IN ENGLISH, max 4 words, title case — e.g. 'High Winter Campaign', 'Quilts & Pillows', 'Bed Linen Sets'. TRANSLATE non-English captions into English (e.g. 'Yorgan ve Yastık' → 'Quilts & Pillows'). Provide a label for EVERY image index you can describe; every label must be distinct; omit an index only if you genuinely cannot tell what it shows — never echo a non-English caption verbatim and never write a generic filler"},
  "hero_index": <index of the best LEAD image for the board — an evocative lifestyle/campaign photo, judged from captions and filenames; avoid promo strips, sale banners and logos>
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

    const palette = capNeutrals(
      (Array.isArray(j.palette) ? j.palette : [])
        .map((p) => ({
          hex: String((p as Record<string, unknown>)?.hex ?? "").trim(),
          name: String((p as Record<string, unknown>)?.name ?? "").trim(),
        }))
        .filter((p) => HEX_RE.test(p.hex))
    );

    // MOODBOARD.md §3: a brand ESSENCE the LLM derives from the website
    // content (grounded synthesis — not a copied slogan, not invented).
    // Shown when derivable, omitted otherwise.
    const essenceText = String(j.essence ?? "").trim();
    const quote =
      essenceText && essenceText.toLowerCase() !== "null"
        ? { text: essenceText, type: "essence" as const }
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
      heroIndex:
        typeof j.hero_index === "number" &&
        j.hero_index >= 0 &&
        j.hero_index < input.images.length
          ? j.hero_index
          : null,
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
    // Last-resort label: humanize a descriptive filename tail —
    // "mss-2_tile---bedlinen_dt.jpg" → "Bedlinen".
    const fromFilename = (src: string): string | null => {
      const file = src.split("/").pop()?.split("?")[0] ?? "";
      const stem = file
        .replace(/\.[a-z0-9]+$/i, "")
        .replace(/[_-](dt|mb|desktop|mobile)$/i, "");
      const tail = stem.split(/-{2,}|_{2}/).pop() ?? "";
      const words = tail.replace(/[_-]+/g, " ").trim();
      if (!/^[a-z][a-z &]{2,28}$/i.test(words)) return null;
      if (orgNorm && normForMatch(words) === orgNorm) return null;
      return words.replace(/\b[a-z]/g, (c) => c.toUpperCase());
    };
    // Only accept raw alt text as a fallback when it is plain ASCII (English-
    // ish) — non-Latin captions (e.g. Turkish "Çarşaf") must never leak to the
    // board, both for the English mandate and because the PDF font can't render
    // them. The LLM label (now translated to English) is the primary source.
    const asciiAlt = (alt: string | null): string | null => {
      if (!alt) return null;
      if (orgNorm && normForMatch(alt) === orgNorm) return null;
      // eslint-disable-next-line no-control-regex
      return /^[\x00-\x7F]+$/.test(alt) ? alt : null;
    };
    const labeledImages = images.map((img, i) => ({
      ...img,
      label:
        editorial?.imageLabels?.[String(i)] ??
        asciiAlt(img.alt) ??
        fromFilename(img.src),
    }));
    // The LLM-chosen hero leads the board (promo strips stay in the grid).
    if (editorial?.heroIndex != null && editorial.heroIndex > 0) {
      const [heroImg] = labeledImages.splice(editorial.heroIndex, 1);
      labeledImages.unshift(heroImg);
    }

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
