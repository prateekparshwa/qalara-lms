import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { hubspotConfigured, pullHubspotDataForLeads } from "@/lib/hubspot";
import { gistEmail, excerptFallback, mapLimit } from "@/lib/emailGist";

// Batched HubSpot calls need the Node.js runtime (not edge). The rollup
// lookups (deal stage/email/company) run concurrently via Promise.allSettled
// in pullHubspotDataForLeads, but each is still a sequence of 100-row batch
// calls — for the bigger segments (engagement is ~4x Customers' row count)
// that's enough sequential HubSpot round-trips to risk running long, so this
// is set well above Customers' original budget rather than tight to it.
export const runtime = "nodejs";
export const maxDuration = 290;

const PAGE = 1000;
const WRITE_CHUNK = 500;
// Emails whose body changed since last sync get a fresh LLM gist. Bounded per
// run so one sync can't stall on thousands of model calls — the rest carry
// over unchanged and are picked up on the next run.
const GIST_PER_RUN = 300;
const GIST_CONCURRENCY = 15;

interface LeadRow {
  id: number;
  email: string | null;
  website: string | null;
}

/**
 * POST /api/leads/hubspot-sync?segment=<any segment key>[&commit=true]
 *
 * Read-only pull from HubSpot (Contacts by email, Companies by domain, plus a
 * best-effort deal stage) — nothing is ever written back to HubSpot. Without
 * `commit=true` this is a DRY RUN: it reports match counts but writes nothing
 * to Supabase, so a sync against thousands of live leads can be previewed
 * before anything changes. Available for every segment, same as the sheet
 * Sync button — not scoped to Customers.
 */
export async function POST(req: NextRequest) {
  const segment = req.nextUrl.searchParams.get("segment") ?? "";
  const commit = req.nextUrl.searchParams.get("commit") === "true";

  if (!segment) {
    return NextResponse.json(
      { message: "No segment specified.", matched: 0, notFound: 0, skipped: 0 },
      { status: 200 }
    );
  }

  if (!hubspotConfigured()) {
    return NextResponse.json(
      {
        message: "HubSpot sync isn't configured yet. Set HUBSPOT_PRIVATE_APP_TOKEN to enable it.",
        matched: 0,
        notFound: 0,
        skipped: 0,
      },
      { status: 200 }
    );
  }

  try {
    // 1. Read every lead in this segment's id/email/website (paginated).
    // email_contact_full lets us re-gist only the emails that actually changed.
    const rows: LeadRow[] = [];
    const fullByLead = new Map<number, string | null>();
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabaseAdmin
        .from("leads")
        .select("id,email,website,email_contact_full")
        .eq("segment", segment)
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      const page = (data ?? []) as unknown as (LeadRow & { email_contact_full: string | null })[];
      for (const r of page) {
        rows.push({ id: r.id, email: r.email, website: r.website });
        fullByLead.set(r.id, r.email_contact_full ?? null);
      }
      if (page.length < PAGE) break;
    }

    if (rows.length === 0) {
      return NextResponse.json({
        message: "No leads found in this segment to sync.",
        matched: 0,
        notFound: 0,
        skipped: 0,
      });
    }

    // 2. Match against HubSpot. Read-only — nothing is written to HubSpot.
    const results = await pullHubspotDataForLeads(rows);

    const matched = results.filter((r) => r.hubspot_match_status === "matched");
    const notFound = results.filter((r) => r.hubspot_match_status === "not_found");
    const skipped = results.filter((r) => r.hubspot_match_status === "skipped");
    const withEmail = results.filter((r) => r.email_subject || r.email_full);

    // Rows whose email body differs from what's stored need a fresh gist.
    const changed = results.filter(
      (r) => r.email_full && r.email_full !== (fullByLead.get(r.id) ?? null)
    );

    if (!commit) {
      return NextResponse.json({
        dryRun: true,
        message:
          `Dry run: would match ${matched.length} of ${rows.length} leads in HubSpot ` +
          `(${notFound.length} not found, ${skipped.length} skipped — no email or website on file), ` +
          `${withEmail.length} with a HubSpot email; ${changed.length} email(s) changed and would be ` +
          `re-gisted (up to ${GIST_PER_RUN} per run). Nothing was written yet.`,
        matched: matched.length,
        notFound: notFound.length,
        skipped: skipped.length,
        withEmail: withEmail.length,
        changed: changed.length,
        total: rows.length,
      });
    }

    // Gist the changed emails (bounded). id -> gist text.
    const toGist = changed.slice(0, GIST_PER_RUN);
    const gistById = new Map<number, string>();
    const gistResults = await mapLimit(toGist, GIST_CONCURRENCY, (r) =>
      gistEmail(r.email_subject, r.email_full)
    );
    toGist.forEach((r, i) => {
      const { gist } = gistResults[i];
      gistById.set(r.id, gist || excerptFallback(r.email_full ?? ""));
    });

    // 3. Commit — batched upsert. Rollup columns are always written for every
    // row. The email fields (last_email_subject / email_contact_summary /
    // email_contact_full / last_qalara_contact / hubspot_email_locked) are
    // touched only for rows whose email actually CHANGED and got a fresh gist
    // this run — unchanged emails and rows past the per-run gist cap keep
    // their existing values (which PRESERVE_COLUMNS carries through a Sheets
    // sync), so a miss never blanks anything.
    const stamp = new Date().toISOString();
    let updated = 0;
    let failed = 0;
    for (let i = 0; i < results.length; i += WRITE_CHUNK) {
      const chunk = results.slice(i, i + WRITE_CHUNK).map((r) => {
        const row: Record<string, unknown> = {
          id: r.id,
          hubspot_contact_id: r.hubspot_contact_id,
          hubspot_company_id: r.hubspot_company_id,
          hubspot_deal_stage: r.hubspot_deal_stage,
          hubspot_last_activity_date: r.hubspot_last_activity_date,
          hubspot_notes_count: r.hubspot_notes_count,
          hubspot_match_status: r.hubspot_match_status,
          hubspot_synced_at: stamp,
        };
        const gist = gistById.get(r.id);
        if (gist !== undefined && (r.email_subject || r.email_full)) {
          row.last_email_subject = r.email_subject;
          row.email_contact_summary = gist;
          row.email_contact_full = r.email_full;
          // Keep the "last contact from Qalara" date in step with the email
          // we just pulled — otherwise it keeps showing the sheet's old date
          // next to a much newer summary.
          if (r.email_date) row.last_qalara_contact = r.email_date;
          row.hubspot_email_locked = true;
        }
        return row;
      });
      const { error } = await supabaseAdmin.from("leads").upsert(chunk, { onConflict: "id" });
      if (error) {
        failed += chunk.length;
        console.error("HubSpot sync: batch update failed:", error.message);
      } else {
        updated += chunk.length;
      }
    }

    const remainingToGist = Math.max(0, changed.length - toGist.length);
    return NextResponse.json({
      dryRun: false,
      message:
        `Synced ${updated} leads from HubSpot ` +
        `(${matched.length} matched, ${notFound.length} not found, ${skipped.length} skipped, ` +
        `${withEmail.length} email(s) pulled, ${toGist.length} re-gisted` +
        (remainingToGist ? `, ${remainingToGist} left for the next run` : "") +
        `)` +
        (failed ? `, ${failed} failed to save` : "") +
        ".",
      matched: matched.length,
      notFound: notFound.length,
      skipped: skipped.length,
      withEmail: withEmail.length,
      gisted: toGist.length,
      gistRemaining: remainingToGist,
      updated,
      failed,
      total: rows.length,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "HubSpot sync failed for an unknown reason.",
      },
      { status: 500 }
    );
  }
}
