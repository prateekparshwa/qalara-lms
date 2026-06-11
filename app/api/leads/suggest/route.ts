import { NextRequest, NextResponse } from "next/server";
import { suggestLeads } from "@/lib/leads";

// Always read live from the DB (never statically cached).
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const segment = req.nextUrl.searchParams.get("segment") ?? undefined;

  if (q.trim().length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const suggestions = await suggestLeads(q, segment);
    return NextResponse.json({ suggestions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
