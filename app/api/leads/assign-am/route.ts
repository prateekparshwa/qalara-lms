import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { updateLeadAmInSheet } from "@/lib/google-sheets";
import { getSegment, segmentSpreadsheetId } from "@/lib/segments";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST { id, am } — assign an Account Manager to a lead.
 * Updates Supabase first (source for the dashboard), then writes the same
 * value back to the segment's Google Sheet so the next sync doesn't undo it.
 */
export async function POST(req: NextRequest) {
  let body: { id?: number; am?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const id = Number(body.id);
  const am = (body.am ?? "").trim();
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Missing lead id." }, { status: 400 });
  }
  if (!am) {
    return NextResponse.json(
      { error: "Missing account manager name." },
      { status: 400 }
    );
  }

  const { data: lead, error: fetchErr } = await supabaseAdmin
    .from("leads")
    .select("id, organization, email, segment, current_am")
    .eq("id", id)
    .single();
  if (fetchErr || !lead) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  const { error: updateErr } = await supabaseAdmin
    .from("leads")
    .update({ current_am: am })
    .eq("id", id);
  if (updateErr) {
    return NextResponse.json(
      { error: `Database update failed: ${updateErr.message}` },
      { status: 500 }
    );
  }

  // Sheet write-back — best-effort: the db is already updated, so report
  // sheet failures instead of failing the whole request.
  let sheet: "updated" | "skipped" = "skipped";
  let sheetError: string | null = null;
  const segment = lead.segment ? getSegment(lead.segment) : undefined;
  if (segment) {
    try {
      await updateLeadAmInSheet(
        segmentSpreadsheetId(segment),
        { organization: lead.organization, email: lead.email },
        am
      );
      sheet = "updated";
    } catch (err) {
      sheetError = err instanceof Error ? err.message : "Sheet update failed.";
      console.error("assign-am sheet write-back failed:", sheetError);
    }
  }

  return NextResponse.json({ ok: true, am, sheet, sheetError });
}
