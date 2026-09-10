import { NextRequest, NextResponse } from "next/server";
import { getBrief } from "@/lib/brief";

export const runtime = "nodejs";

/**
 * GET /api/brief?email=<qalara login email>
 *
 * Returns the AM's daily brief: leads (re)assigned to them since they last
 * opened it. `email` is the self-entered identity (localStorage) for now;
 * swap to the session email once SSO lands.
 */
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email") ?? "";
  try {
    const brief = await getBrief(email);
    return NextResponse.json(brief);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't build the brief." },
      { status: 500 }
    );
  }
}
