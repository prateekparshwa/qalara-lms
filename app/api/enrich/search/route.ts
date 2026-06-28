import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { tinyfishSearch } from "@/lib/tinyfish";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const { leadId, org, country, categories } = await req.json();

  if (!org) {
    return NextResponse.json(
      { error: "Organization name is required" },
      { status: 400 }
    );
  }

  // Check cache
  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("enrichment_cache, enriched_at")
    .eq("id", leadId)
    .single();

  if (lead?.enrichment_cache?.search && lead.enriched_at) {
    const age = Date.now() - new Date(lead.enriched_at).getTime();
    if (age < 7 * 24 * 60 * 60 * 1000) {
      // The cache stores { query, result }. Unwrap it so a cached hit returns
      // the same shape as a fresh call ({ cached, query, result }) — no extra
      // nesting in the UI. Fall back to the raw entry for any legacy shape.
      const cached = lead.enrichment_cache.search as {
        query?: string;
        result?: unknown;
      };
      const hasWrapper =
        cached && typeof cached === "object" && "result" in cached;
      return NextResponse.json({
        cached: true,
        query: hasWrapper ? cached.query : undefined,
        result: hasWrapper ? cached.result : cached,
      });
    }
  }

  const query = `${org} ${country ?? ""} ${categories ?? "home decor wholesale"}`.trim();

  try {
    // TinyFish Search — structured, ranked results for LLM/agent use. Free.
    const result = await tinyfishSearch(query);

    // Cache result
    const existingCache =
      (lead?.enrichment_cache as Record<string, unknown>) ?? {};
    await supabaseAdmin
      .from("leads")
      .update({
        enrichment_cache: { ...existingCache, search: { query, result } },
        enriched_at: new Date().toISOString(),
      })
      .eq("id", leadId);

    return NextResponse.json({ cached: false, query, result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search failed" },
      { status: 500 }
    );
  }
}
