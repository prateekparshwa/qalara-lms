import { NextRequest, NextResponse } from "next/server";
import { getFilterOptions } from "@/lib/leads";

// Always read live from the DB (never statically cached at build).
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const segment = req.nextUrl.searchParams.get("segment") ?? undefined;
  try {
    const options = await getFilterOptions(segment);
    return NextResponse.json(options);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
