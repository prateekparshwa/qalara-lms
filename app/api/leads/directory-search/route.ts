import { NextRequest, NextResponse } from "next/server";
import { searchDirectory } from "@/lib/leads";
import { activeSegmentKeys, getSegment } from "@/lib/segments";

// Always read live from the DB (never statically cached).
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Cross-segment buyer search for the Directory chooser page — lets a user who
 * knows a buyer's details (but not which segment they're in) find them
 * directly, instead of guessing a segment card. Scoped to active, non-
 * deferred segments only (never 'discover').
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const org = sp.get("org") ?? undefined;
  const website = sp.get("website") ?? undefined;
  const email = sp.get("email") ?? undefined;
  const buyerName = sp.get("buyerName") ?? undefined;
  const country = sp.get("country") ?? undefined;

  if (!org?.trim() && !website?.trim() && !email?.trim() && !buyerName?.trim() && !country?.trim()) {
    return NextResponse.json(
      { error: "Enter at least one detail to search." },
      { status: 400 }
    );
  }

  try {
    const segments = activeSegmentKeys();
    const { data, total } = await searchDirectory(
      { org, website, email, buyerName, country },
      segments
    );
    const results = data.map((lead) => ({
      ...lead,
      segmentLabel: getSegment(lead.segment ?? "")?.label ?? lead.segment,
    }));
    return NextResponse.json({ data: results, total });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search failed." },
      { status: 500 }
    );
  }
}
