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
 * Upsert one write chunk, splitting it in half and retrying on failure. A
 * chunk carrying many freshly-gisted full email bodies can be large enough
 * to hit a Supabase request timeout ("Gateway Timeout") even though each
 * individual row is fine — seen live on WRITE_CHUNK-sized batches heavy with
 * new gists. Halving isolates the slow/oversized part instead of failing the
 * whole chunk; a single row that still fails after the split is a real
 * per-row problem, not a size issue, so it's counted as failed and reported.
 * The two halves are retried sequentially, not concurrently — a timeout is
 * often a sign of contention on the DB connection, and firing two parallel
 * retries would double the pressure that likely caused it in the first place.
 */
async function upsertChunkWithRetry(
  chunk: Record<string, unknown>[]
): Promise<{ done: number; fail: number }> {
  if (chunk.length === 0) return { done: 0, fail: 0 };
  const { error } = await supabaseAdmin.from("leads").upsert(chunk, { onConflict: "id" });
  if (!error) return { done: chunk.length, fail: 0 };

  if (chunk.length === 1) {
    console.error(`HubSpot sync: batch update failed for lead ${chunk[0].id}:`, error.message);
    return { done: 0, fail: 1 };
  }

  console.error(
    `HubSpot sync: batch update failed for ${chunk.length} rows, splitting and retrying:`,
    error.message
  );
  const mid = Math.ceil(chunk.length / 2);
  const a = await upsertChunkWithRetry(chunk.slice(0, mid));
  const b = await upsertChunkWithRetry(chunk.slice(mid));
  return { done: a.done + b.done, fail: a.fail + b.fail };
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
    // email_contact_full / last_contact_date let us re-gist only the emails
    // that actually changed, on each side of the conversation.
    const rows: LeadRow[] = [];
    const fullByLead = new Map<number, string | null>();
    const lastInboundDateByLead = new Map<number, string | null>();
    const snapshotByLead = new Map<number, string | null>();
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabaseAdmin
        .from("leads")
        .select("id,email,website,email_contact_full,last_contact_date,email_snapshot")
        .eq("segment", segment)
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      const page = (data ?? []) as unknown as (LeadRow & {
        email_contact_full: string | null;
        last_contact_date: string | null;
        email_snapshot: string | null;
      })[];
      for (const r of page) {
        rows.push({ id: r.id, email: r.email, website: r.website });
        fullByLead.set(r.id, r.email_contact_full ?? null);
        lastInboundDateByLead.set(r.id, r.last_contact_date ?? null);
        snapshotByLead.set(r.id, r.email_snapshot ?? null);
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

    // Rows whose outbound email body differs from what's stored need a fresh
    // outbound gist; rows whose inbound date moved on, OR that have inbound
    // content but no snapshot yet, need a fresh inbound one. The "no snapshot
    // yet" half matters because last_contact_date is written unconditionally
    // below (a cheap plain fact, not gated on the per-run gist budget) — so a
    // row that loses the gist-budget race on the run its date first syncs
    // would otherwise look "unchanged" on every later run forever, despite
    // never having gotten a snapshot.
    const changedOutbound = results.filter(
      (r) => r.email_full && r.email_full !== (fullByLead.get(r.id) ?? null)
    );
    const changedInbound = results.filter(
      (r) =>
        r.inbound_full &&
        (!snapshotByLead.get(r.id) || r.inbound_date !== (lastInboundDateByLead.get(r.id) ?? null))
    );

    if (!commit) {
      return NextResponse.json({
        dryRun: true,
        message:
          `Dry run: would match ${matched.length} of ${rows.length} leads in HubSpot ` +
          `(${notFound.length} not found, ${skipped.length} skipped — no email or website on file), ` +
          `${withEmail.length} with a HubSpot email; ${changedOutbound.length} outbound and ` +
          `${changedInbound.length} inbound email(s) changed and would be re-gisted ` +
          `(up to ${GIST_PER_RUN} of each per run). Nothing was written yet.`,
        matched: matched.length,
        notFound: notFound.length,
        skipped: skipped.length,
        withEmail: withEmail.length,
        changed: changedOutbound.length,
        changedInbound: changedInbound.length,
        total: rows.length,
      });
    }

    // Gist the changed emails (bounded, each direction separately). id -> gist text.
    const toGistOutbound = changedOutbound.slice(0, GIST_PER_RUN);
    const gistOutboundById = new Map<number, string>();
    const outboundGistResults = await mapLimit(toGistOutbound, GIST_CONCURRENCY, (r) =>
      gistEmail(r.email_subject, r.email_full)
    );
    toGistOutbound.forEach((r, i) => {
      const { gist } = outboundGistResults[i];
      gistOutboundById.set(r.id, gist || excerptFallback(r.email_full ?? ""));
    });

    const toGistInbound = changedInbound.slice(0, GIST_PER_RUN);
    const gistInboundById = new Map<number, string>();
    const inboundGistResults = await mapLimit(toGistInbound, GIST_CONCURRENCY, (r) =>
      gistEmail(r.inbound_subject, r.inbound_full)
    );
    toGistInbound.forEach((r, i) => {
      const { gist } = inboundGistResults[i];
      gistInboundById.set(r.id, gist || excerptFallback(r.inbound_full ?? ""));
    });

    // 3. Commit — batched upsert. Rollup columns are always written for every
    // row, as are the plain contact-date fields (first_contact_date /
    // last_contact_date — cheap, no LLM call, so no reason to gate them on
    // the gist budget). The gisted fields (last_email_subject /
    // email_contact_summary / email_contact_full / last_qalara_contact /
    // email_snapshot / hubspot_email_locked) are touched only for rows whose
    // email actually CHANGED and got a fresh gist this run — unchanged emails
    // and rows past the per-run gist cap keep their existing values (which
    // PRESERVE_COLUMNS carries through a Sheets sync), so a miss never blanks
    // anything.
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
        // "By buyer" contact dates — plain HubSpot facts, always kept current.
        if (r.first_inbound_date) row.first_contact_date = r.first_inbound_date;
        if (r.inbound_date) row.last_contact_date = r.inbound_date;

        const outboundGist = gistOutboundById.get(r.id);
        if (outboundGist !== undefined && (r.email_subject || r.email_full)) {
          row.last_email_subject = r.email_subject;
          row.email_contact_summary = outboundGist;
          row.email_contact_full = r.email_full;
          // Keep the "last contact from Qalara" date in step with the email
          // we just pulled — otherwise it keeps showing the sheet's old date
          // next to a much newer summary.
          if (r.email_date) row.last_qalara_contact = r.email_date;
          row.hubspot_email_locked = true;
        }

        const inboundGist = gistInboundById.get(r.id);
        if (inboundGist !== undefined && (r.inbound_subject || r.inbound_full)) {
          row.email_snapshot = inboundGist;
        }
        return row;
      });
      const { done, fail } = await upsertChunkWithRetry(chunk);
      updated += done;
      failed += fail;
    }

    const remainingToGistOutbound = Math.max(0, changedOutbound.length - toGistOutbound.length);
    const remainingToGistInbound = Math.max(0, changedInbound.length - toGistInbound.length);
    return NextResponse.json({
      dryRun: false,
      message:
        `Synced ${updated} leads from HubSpot ` +
        `(${matched.length} matched, ${notFound.length} not found, ${skipped.length} skipped, ` +
        `${withEmail.length} email(s) pulled, ${toGistOutbound.length} outbound + ${toGistInbound.length} inbound re-gisted` +
        (remainingToGistOutbound || remainingToGistInbound
          ? `, ${remainingToGistOutbound + remainingToGistInbound} left for the next run`
          : "") +
        `)` +
        (failed ? `, ${failed} failed to save` : "") +
        ".",
      matched: matched.length,
      notFound: notFound.length,
      skipped: skipped.length,
      withEmail: withEmail.length,
      gisted: toGistOutbound.length,
      gistedInbound: toGistInbound.length,
      gistRemaining: remainingToGistOutbound + remainingToGistInbound,
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
