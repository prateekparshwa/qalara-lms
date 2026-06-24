import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { updateLeadsAmInSheetBulk } from "@/lib/google-sheets";
import { getSegment, segmentSpreadsheetId } from "@/lib/segments";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BULK = 500;

/** Placeholder written when leads are bulk-unassigned. */
const UNASSIGNED = "No Active AM";

/**
 * POST { ids: number[], am }          — assign one AM to many leads at once.
 * POST { ids: number[], unassign: true } — clear the AM on many leads at once
 *                                          (sets it to "No Active AM").
 *
 * Either action LOCKS the leads (am_locked = true) so a later sheet sync won't
 * revert it. Updates Supabase in a single statement (the dashboard's source of
 * truth), then writes the same value back to each segment's Google Sheet with
 * ONE sheet read + batchUpdate per segment (not per lead).
 */
export async function POST(req: NextRequest) {
  let body: { ids?: unknown; am?: unknown; unassign?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const unassign = body.unassign === true;
  const am = unassign
    ? UNASSIGNED
    : (typeof body.am === "string" ? body.am : "").trim();
  const ids = Array.isArray(body.ids)
    ? Array.from(
        new Set(
          body.ids
            .map((v) => Number(v))
            .filter((n) => Number.isFinite(n) && n > 0)
        )
      )
    : [];

  if (!am) {
    return NextResponse.json(
      { error: "Missing account manager name." },
      { status: 400 }
    );
  }
  if (ids.length === 0) {
    return NextResponse.json(
      { error: "Select at least one lead to assign." },
      { status: 400 }
    );
  }
  if (ids.length > MAX_BULK) {
    return NextResponse.json(
      { error: `Too many leads at once (max ${MAX_BULK}).` },
      { status: 400 }
    );
  }

  // Pull the rows we're about to touch — needed for the sheet write-back match.
  const { data: leads, error: fetchErr } = await supabaseAdmin
    .from("leads")
    .select("id, organization, email, segment")
    .in("id", ids);
  if (fetchErr) {
    return NextResponse.json(
      { error: `Lookup failed: ${fetchErr.message}` },
      { status: 500 }
    );
  }
  if (!leads || leads.length === 0) {
    return NextResponse.json({ error: "No matching leads found." }, { status: 404 });
  }

  // Database update — one statement for all ids. Lock each so a later sync
  // can't revert the assignment from the sheet (released only in the dashboard).
  const { error: updateErr } = await supabaseAdmin
    .from("leads")
    .update({ current_am: am, am_locked: true })
    .in("id", ids);
  if (updateErr) {
    return NextResponse.json(
      { error: `Database update failed: ${updateErr.message}` },
      { status: 500 }
    );
  }

  // Sheet write-back — best-effort, grouped by segment so each sheet is read
  // once. The db is already updated, so sheet errors are reported, not fatal.
  const bySegment = new Map<
    string,
    { organization: string | null; email: string | null }[]
  >();
  for (const l of leads) {
    if (!l.segment) continue;
    const arr = bySegment.get(l.segment) ?? [];
    arr.push({ organization: l.organization, email: l.email });
    bySegment.set(l.segment, arr);
  }

  let sheetUpdated = 0;
  const sheetErrors: string[] = [];
  const unmatched: string[] = [];
  for (const [segKey, matches] of Array.from(bySegment.entries())) {
    const segment = getSegment(segKey);
    if (!segment) continue; // e.g. "discover" — no sheet to write back to.
    try {
      const res = await updateLeadsAmInSheetBulk(
        segmentSpreadsheetId(segment),
        matches,
        am
      );
      sheetUpdated += res.updated;
      unmatched.push(...res.unmatched);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sheet update failed.";
      sheetErrors.push(`${segment.label}: ${msg}`);
      console.error(`assign-am-bulk sheet write-back failed (${segKey}):`, msg);
    }
  }

  return NextResponse.json({
    ok: true,
    am,
    assigned: leads.length,
    sheetUpdated,
    unmatched,
    sheetErrors,
  });
}
