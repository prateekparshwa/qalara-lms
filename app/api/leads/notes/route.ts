import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * POST { id, notes, author? } — save free-text AM notes for a lead.
 * Notes live only in the database (never in the sheet) and are preserved across
 * syncs. Stamps who saved (soft identity) and when.
 */
export async function POST(req: NextRequest) {
  let body: { id?: number; notes?: unknown; author?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const id = Number(body.id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Missing lead id." }, { status: 400 });
  }

  const raw = typeof body.notes === "string" ? body.notes : "";
  const notes = raw.trim() === "" ? null : raw;
  const author =
    (typeof body.author === "string" ? body.author : "").trim() || null;
  const stamp = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from("leads")
    .update({
      notes,
      notes_updated_at: stamp,
      notes_updated_by: author,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: `Database update failed: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    notes,
    notes_updated_at: stamp,
    notes_updated_by: author,
  });
}
