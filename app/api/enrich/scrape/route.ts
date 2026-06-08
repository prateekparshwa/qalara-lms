import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

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
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({
        url,
        formats: ["markdown", "extract"],
        extract: {
          prompt:
            "Extract: company name, description, product categories, countries served, estimated size/scale. Return as JSON.",
        },
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: result.error ?? "Firecrawl error" },
        { status: 502 }
      );
    }

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
