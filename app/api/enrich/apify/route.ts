import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { leadId, org, url, email } = await req.json();

  const actorId = process.env.APIFY_ACTOR_ID ?? "apify/website-content-crawler";
  const token = process.env.APIFY_API_TOKEN;

  if (!token) {
    return NextResponse.json({ error: "Apify not configured" }, { status: 500 });
  }

  // Check cache
  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("enrichment_cache, enriched_at")
    .eq("id", leadId)
    .single();

  if (lead?.enrichment_cache?.apify && lead.enriched_at) {
    const age = Date.now() - new Date(lead.enriched_at).getTime();
    if (age < 7 * 24 * 60 * 60 * 1000) {
      return NextResponse.json({
        cached: true,
        result: lead.enrichment_cache.apify,
      });
    }
  }

  try {
    // Start actor run
    const runRes = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/runs?token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startUrls: url ? [{ url }] : [],
          query: org,
          email,
          maxCrawlPages: 3,
        }),
      }
    );

    const runData = await runRes.json();
    const runId = runData?.data?.id;

    if (!runId) {
      return NextResponse.json({ error: "Failed to start Apify actor" }, { status: 502 });
    }

    // Poll for completion (max 30s)
    let attempts = 0;
    let dataset = null;
    while (attempts < 15) {
      await new Promise((r) => setTimeout(r, 2000));
      const statusRes = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${token}`
      );
      const statusData = await statusRes.json();
      const status = statusData?.data?.status;

      if (status === "SUCCEEDED") {
        const dataRes = await fetch(
          `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${token}&limit=5`
        );
        dataset = await dataRes.json();
        break;
      } else if (status === "FAILED" || status === "ABORTED") {
        return NextResponse.json({ error: `Actor ${status}` }, { status: 502 });
      }
      attempts++;
    }

    if (!dataset) {
      return NextResponse.json(
        { error: "Apify actor timed out" },
        { status: 504 }
      );
    }

    // Cache result
    const existingCache =
      (lead?.enrichment_cache as Record<string, unknown>) ?? {};
    await supabaseAdmin
      .from("leads")
      .update({
        enrichment_cache: { ...existingCache, apify: { runId, dataset } },
        enriched_at: new Date().toISOString(),
      })
      .eq("id", leadId);

    return NextResponse.json({ cached: false, runId, result: dataset });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Apify failed" },
      { status: 500 }
    );
  }
}
