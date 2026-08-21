import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { updateLeadAmInSheet } from "@/lib/google-sheets";
import { getSegment, segmentSpreadsheetId, sheetOptionsFor } from "@/lib/segments";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST { id, am }            — assign an Account Manager to a lead (and LOCK it,
 *                              so a later sync can't revert it from the sheet).
 * POST { id, release: true } — release the lock back to the sheet: the next
 *                              sync will adopt the sheet's AM value again.
 *
 * Updates Supabase first (source for the dashboard), then writes the AM back to
 * the segment's Google Sheet so the value matches there too.
 */
export async function POST(req: NextRequest) {
  let body: { id?: number; am?: string; release?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const id = Number(body.id);
  const release = body.release === true;
  const am = (body.am ?? "").trim();
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Missing lead id." }, { status: 400 });
  }
  if (!release && !am) {
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

  // Release just clears the dashboard lock — the AM value itself is left as-is
  // until the next sync hands control back to the sheet.
  if (release) {
    const { error: relErr } = await supabaseAdmin
      .from("leads")
      .update({ am_locked: false })
      .eq("id", id);
    if (relErr) {
      return NextResponse.json(
        { error: `Database update failed: ${relErr.message}` },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, released: true });
  }

  const { error: updateErr } = await supabaseAdmin
    .from("leads")
    .update({ current_am: am, am_locked: true })
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
        am,
        sheetOptionsFor(segment)
      );
      sheet = "updated";
    } catch (err) {
      sheetError = err instanceof Error ? err.message : "Sheet update failed.";
      console.error("assign-am sheet write-back failed:", sheetError);
    }
  }

  return NextResponse.json({ ok: true, am, sheet, sheetError });
}
