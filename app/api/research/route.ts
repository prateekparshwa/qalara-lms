import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { priorityRank } from "@/lib/leads";
import { DISCOVER_SEGMENT } from "@/lib/segments";
import { researchOrgProfile } from "@/lib/researchOrg";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: {
    org?: string;
    website?: string;
    email?: string;
    buyerName?: string;
    country?: string;
    model?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!body.org && !body.website && !body.email) {
    return NextResponse.json(
      { error: "Enter an organization, website, or email to research." },
      { status: 400 }
    );
  }
  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json(
      { error: "Research isn't configured yet (missing OPENROUTER_API_KEY)." },
      { status: 200 }
    );
  }

  try {
    const { row, usedScrape, searchCount, contactSource } = await researchOrgProfile(body);

    // 4. Auto-save into the 'discover' segment, de-duplicated.
    const record = {
      ...row,
      segment: DISCOVER_SEGMENT,
      source: "Web Research",
      priority_rank: priorityRank(null),
      imported_at: new Date().toISOString(),
      enriched_at: new Date().toISOString(),
    };

    // Find an existing discovered row by website → email → organization.
    let existingId: number | null = null;
    const matchers: [string, string | null][] = [
      ["website", row.website],
      ["email", row.email],
      ["organization", row.organization],
    ];
    for (const [col, val] of matchers) {
      if (!val) continue;
      const { data } = await supabaseAdmin
        .from("leads")
        .select("id")
        .eq("segment", DISCOVER_SEGMENT)
        .ilike(col, val)
        .limit(1)
        .maybeSingle();
      if (data?.id) {
        existingId = data.id as number;
        break;
      }
    }

    let savedId = existingId;
    if (existingId) {
      const { error } = await supabaseAdmin
        .from("leads")
        .update(record)
        .eq("id", existingId);
      if (error) throw new Error(error.message);
    } else {
      const { data, error } = await supabaseAdmin
        .from("leads")
        .insert(record)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      savedId = data?.id ?? null;
    }

    return NextResponse.json({
      profile: row,
      savedId,
      updated: !!existingId,
      usedScrape,
      searchCount,
      contactSource,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Research failed." },
      { status: 500 }
    );
  }
}
