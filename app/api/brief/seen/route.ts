import { NextRequest, NextResponse } from "next/server";
import { markBriefSeen } from "@/lib/brief";

export const runtime = "nodejs";

/**
 * POST /api/brief/seen  { email }
 * Stamps the AM's "last opened the brief" marker so the unread count resets.
 */
export async function POST(req: NextRequest) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  try {
    const amName = await markBriefSeen(body.email ?? "");
    return NextResponse.json({ ok: true, amName });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't update the brief." },
      { status: 500 }
    );
  }
}
