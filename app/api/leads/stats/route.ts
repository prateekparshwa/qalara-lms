import { NextResponse } from "next/server";
import { getLeadStats } from "@/lib/leads";

// Always read live from the DB (never statically cached at build).
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const stats = await getLeadStats();
    return NextResponse.json(stats);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
