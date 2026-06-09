import { NextRequest, NextResponse } from "next/server";
import { getLeadStats, getLastSynced } from "@/lib/leads";

// Always read live from the DB (never statically cached at build).
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const segment = req.nextUrl.searchParams.get("segment") ?? undefined;
  try {
    const [stats, lastSynced] = await Promise.all([
      getLeadStats(segment),
      getLastSynced(segment),
    ]);
    return NextResponse.json({ ...stats, lastSynced });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
