import { NextRequest, NextResponse } from "next/server";
import { getLeads } from "@/lib/leads";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  try {
    const result = await getLeads({
      segment: sp.get("segment") ?? undefined,
      q: sp.get("q") ?? "",
      org: sp.get("org") ?? undefined,
      email: sp.get("email") ?? undefined,
      website: sp.get("website") ?? undefined,
      country: sp.get("country") ?? undefined,
      buyer_type: sp.get("buyer_type") ?? undefined,
      classification: sp.get("classification") ?? undefined,
      am: sp.get("am") ?? undefined,
      confidence: sp.get("confidence") ?? undefined,
      page: Number(sp.get("page") ?? 1),
      limit: Number(sp.get("limit") ?? 50),
      sort: sp.get("sort") ?? "organization",
      order: (sp.get("order") ?? "asc") as "asc" | "desc",
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
