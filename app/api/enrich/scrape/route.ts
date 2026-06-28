import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { tinyfishFetch } from "@/lib/tinyfish";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { leadId, url } = await req.json();

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  // Check cache first (7-day TTL)
  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("enrichment_cache, enriched_at")
    .eq("id", leadId)
    .single();

  if (lead?.enrichment_cache?.scrape && lead.enriched_at) {
    const age = Date.now() - new Date(lead.enriched_at).getTime();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    if (age < sevenDays) {
      return NextResponse.json({
        cached: true,
        result: lead.enrichment_cache.scrape,
      });
    }
  }

  try {
    // TinyFish Fetch — renders the page (incl. JS-heavy sites) and returns
    // clean markdown. Free endpoint; a drop-in replacement for Firecrawl.
    const data = await tinyfishFetch([url], { format: "markdown" });
    const page = data.results?.[0];
    if (!page) {
      const err = data.errors?.[0]?.error ?? "Fetch returned no content.";
      return NextResponse.json({ error: err }, { status: 502 });
    }

    const result = {
      source: "tinyfish",
      title: page.title ?? null,
      url: page.final_url ?? url,
      description: page.description ?? null,
      language: page.language ?? null,
      content: page.text ?? "",
    };

    // Cache result
    const existingCache =
      (lead?.enrichment_cache as Record<string, unknown>) ?? {};
    await supabaseAdmin
      .from("leads")
      .update({
        enrichment_cache: { ...existingCache, scrape: result },
        enriched_at: new Date().toISOString(),
      })
      .eq("id", leadId);

    return NextResponse.json({ cached: false, result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Scrape failed" },
      { status: 500 }
    );
  }
}
