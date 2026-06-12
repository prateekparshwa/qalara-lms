import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { scrapeImages, brandRetrieve, bareDomain, CtxImage } from "@/lib/contextdev";
import { firecrawlScrape } from "@/lib/firecrawl";
import { openrouterComplete, parseJsonLoose } from "@/lib/openrouter";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Builds a per-buyer visual moodboard from their website:
 *   - image grid    — context.dev /web/scrape/images (the site's own photos)
 *   - brand layer   — context.dev /brand/retrieve (logo, official colors, blurb)
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

interface EditorialLayer {
  tagline: string | null;
  aesthetic: string | null;
  voiceKeywords: string[];
  collections: string[];
  palette: { hex: string; name: string }[];
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

function asStringArray(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((s) => String(s ?? "").trim())
    .filter(Boolean)
    .slice(0, max);
}

/** LLM pass — turn scraped content + brand data into the editorial layer. */
async function buildEditorialLayer(input: {
  org: string | null;
  brandDescription: string | null;
  slogan: string | null;
  knownColors: { hex: string; name?: string }[];
  imageAlts: string[];
  markdown: string | null;
  leadContext: { categories: string | null; target_audience: string | null };
}): Promise<EditorialLayer | null> {
  if (!process.env.OPENROUTER_API_KEY) return null;

  const system =
    "You are a brand analyst preparing an editorial moodboard for a wholesale " +
    "sourcing team. Respond with a single JSON object only — no prose, no code fences.";

  const known = input.knownColors
    .map((c) => (c.name ? `${c.hex} (${c.name})` : c.hex))
    .join(", ");
  const user = [
    `Brand: ${input.org ?? "Unknown"}`,
    input.slogan ? `Official slogan: ${input.slogan}` : null,
    input.brandDescription ? `About: ${input.brandDescription}` : null,
    input.leadContext.categories
      ? `Product categories: ${input.leadContext.categories}`
      : null,
    input.leadContext.target_audience
      ? `Target audience: ${input.leadContext.target_audience}`
      : null,
    known ? `Known official brand colors: ${known}` : null,
    input.imageAlts.length
      ? `Image captions found on their site: ${input.imageAlts.join(" | ")}`
      : null,
    input.markdown
      ? `Website content (excerpt):\n${input.markdown.slice(0, 5000)}`
      : null,
    "",
    "Return JSON with exactly these keys:",
    `{
  "tagline": "one short evocative sentence capturing the brand's promise, in its own voice (quote-style)",
  "aesthetic": "3-5 word phrase describing the visual aesthetic",
  "voice_keywords": ["exactly 5 single-word brand-voice adjectives"],
  "collections": ["up to 6 sub-brands, collections or product lines actually named in the content; [] if none"],
  "palette": [{"hex": "#RRGGBB", "name": "evocative color name"} — exactly 4 colors representing the brand; start with the known official colors, then complete the palette with colors evident from the imagery/content]
}`,
  ]
    .filter((l) => l !== null)
    .join("\n");

  try {
    const raw = await openrouterComplete(system, user);
    const j = parseJsonLoose(raw);
    const palette = (Array.isArray(j.palette) ? j.palette : [])
      .map((p) => ({
        hex: String((p as Record<string, unknown>)?.hex ?? "").trim(),
        name: String((p as Record<string, unknown>)?.name ?? "").trim(),
      }))
      .filter((p) => HEX_RE.test(p.hex))
      .slice(0, 4);
    const tagline = String(j.tagline ?? "").trim() || null;
    const aesthetic = String(j.aesthetic ?? "").trim() || null;
    return {
      tagline,
      aesthetic,
      voiceKeywords: asStringArray(j.voice_keywords, 5),
      collections: asStringArray(j.collections, 6),
      palette,
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
    .select("enrichment_cache, organization, categories, target_audience")
    .eq("id", leadId)
    .single();

  const cache =
    (lead?.enrichment_cache as Record<string, unknown> | null) ?? {};
  const cached = cache.moodboard as
    | { fetchedAt?: string; editorial?: unknown }
    | undefined;
  // "editorial" in cached distinguishes v2 boards — v1 entries rebuild.
  if (!force && cached?.fetchedAt && "editorial" in cached) {
    const age = Date.now() - new Date(cached.fetchedAt).getTime();
    if (age < TTL_MS) {
      return NextResponse.json({ cached: true, result: cached });
    }
  }

  try {
    // Images, brand data and site content are independent — fetch in
    // parallel; each may fail alone without sinking the board.
    const [imagesRes, brandRes, scrapeRes] = await Promise.allSettled([
      scrapeImages(fullUrl),
      brandRetrieve(bareDomain(fullUrl)),
      firecrawlScrape(fullUrl),
    ]);

    const images =
      imagesRes.status === "fulfilled" ? filterImages(imagesRes.value) : [];
    const brand = brandRes.status === "fulfilled" ? brandRes.value : null;
    const markdown =
      scrapeRes.status === "fulfilled" ? (scrapeRes.value?.markdown ?? null) : null;

    const [editorial, screenshot] = await Promise.all([
      buildEditorialLayer({
        org: brand?.title ?? (lead?.organization as string | null) ?? null,
        brandDescription: brand?.description ?? null,
        slogan: brand?.slogan ?? null,
        knownColors: brand?.colors ?? [],
        imageAlts: images.map((i) => i.alt).filter((a): a is string => !!a),
        markdown,
        leadContext: {
          categories: (lead?.categories as string | null) ?? null,
          target_audience: (lead?.target_audience as string | null) ?? null,
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

    const result = {
      brand,
      images,
      screenshot,
      editorial,
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
