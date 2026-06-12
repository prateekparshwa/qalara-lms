import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { scrapeImages, brandRetrieve, bareDomain, CtxImage } from "@/lib/contextdev";

export const maxDuration = 60;

/**
 * Builds a per-buyer visual moodboard from their website:
 *   - image grid    — context.dev /web/scrape/images (the site's own photos)
 *   - brand layer   — context.dev /brand/retrieve (logo, official colors, blurb)
 *   - screenshot    — Firecrawl full-page capture, fetched only when the image
 *                     grid comes back thin (sites that block headless scraping)
 * Cached in enrichment_cache.moodboard with a 7-day TTL — each build costs
 * real API credits, so it only runs on demand from the dossier.
 */

const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_IMAGES = 12;
const MIN_IMAGES_BEFORE_SCREENSHOT = 4;

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

export async function POST(req: NextRequest) {
  const { leadId, url } = await req.json();
  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }
  const fullUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;

  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("enrichment_cache")
    .eq("id", leadId)
    .single();

  const cache =
    (lead?.enrichment_cache as Record<string, unknown> | null) ?? {};
  const cached = cache.moodboard as { fetchedAt?: string } | undefined;
  if (cached?.fetchedAt) {
    const age = Date.now() - new Date(cached.fetchedAt).getTime();
    if (age < TTL_MS) {
      return NextResponse.json({ cached: true, result: cached });
    }
  }

  try {
    // Images and brand data are independent — fetch in parallel; either may
    // fail on its own (blocked site, unknown domain) without sinking the board.
    const [imagesRes, brandRes] = await Promise.allSettled([
      scrapeImages(fullUrl),
      brandRetrieve(bareDomain(fullUrl)),
    ]);

    const images =
      imagesRes.status === "fulfilled" ? filterImages(imagesRes.value) : [];
    const brand = brandRes.status === "fulfilled" ? brandRes.value : null;

    const screenshot =
      images.length < MIN_IMAGES_BEFORE_SCREENSHOT
        ? await firecrawlScreenshot(fullUrl)
        : null;

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
