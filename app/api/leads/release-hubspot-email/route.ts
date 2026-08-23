import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST { id } — release a HubSpot-locked email (last_email_subject /
 * email_contact_summary) back to the sheet's control. Mirrors
 * /api/leads/assign-am's release action for current_am/am_locked: this only
 * clears the lock, the field values themselves are left as-is until the next
 * Google Sheets sync overwrites them.
 */
export async function POST(req: NextRequest) {
  let body: { id?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const id = Number(body.id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Missing lead id." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("leads")
    .update({ hubspot_email_locked: false })
    .eq("id", id);
  if (error) {
    return NextResponse.json(
      { error: `Database update failed: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, released: true });
}
