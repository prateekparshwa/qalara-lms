import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { hubspotConfigured, pullHubspotDataForLeads } from "@/lib/hubspot";
import { emailExcerpt } from "@/lib/emailGist";

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

interface LeadRow {
  id: number;
  email: string | null;
  website: string | null;
}

/**
 * Split rows into groups that share an identical column set.
 *
 * supabase-js normalises a bulk upsert by unioning the keys across every row
 * in the payload and filling the ones a given row doesn't have with NULL — and
 * the upsert's DO UPDATE then writes those NULLs over the stored values. The
 * rows built below deliberately carry different key sets (only leads that got
 * a fresh gist this run include the email columns), so a single mixed request
 * silently blanks those columns for every OTHER lead in the same chunk. That
 * put the sync on a treadmill: each run wiped the rows it had populated on the
 * previous one, so they re-entered the "changed" queue and the backlog never
 * converged.
 *
 * Grouping by exact key signature keeps every request uniform, so a request
 * only ever touches the columns its own rows actually set.
 */
function groupByColumnSignature(
  rows: Record<string, unknown>[]
): Record<string, unknown>[][] {
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const signature = Object.keys(row).sort().join("|");
    const existing = groups.get(signature);
    if (existing) existing.push(row);
    else groups.set(signature, [row]);
  }
  return Array.from(groups.values());
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

    // Only emails that actually changed get their summary field rewritten, so
    // a hand-written summary survives every sync until a newer email arrives.
    // Inbound also counts "content but no snapshot yet" as changed:
    // last_contact_date is written for every row below, so comparing dates
    // alone would miss a row whose date is current but whose snapshot is empty.
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
          `${changedInbound.length} inbound email(s) changed and would be refreshed. ` +
          `Nothing was written yet.`,
        matched: matched.length,
        notFound: notFound.length,
        skipped: skipped.length,
        withEmail: withEmail.length,
        changed: changedOutbound.length,
        changedInbound: changedInbound.length,
        total: rows.length,
      });
    }

    // id -> excerpt of the newest message, for each changed email.
    const outboundSummaryById = new Map<number, string>(
      changedOutbound.map((r) => [r.id, emailExcerpt(r.email_full ?? "")])
    );
    const inboundSummaryById = new Map<number, string>(
      changedInbound.map((r) => [r.id, emailExcerpt(r.inbound_full ?? "")])
    );

    // 3. Commit — batched upsert. Rollup columns and the plain contact-date
    // fields are written for every row. The email fields (last_email_subject /
    // email_contact_summary / email_contact_full / last_qalara_contact /
    // email_snapshot / hubspot_email_locked) are touched only for rows whose
    // email actually CHANGED — unchanged rows keep their existing values.
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

        const outboundSummary = outboundSummaryById.get(r.id);
        if (outboundSummary !== undefined && (r.email_subject || r.email_full)) {
          row.last_email_subject = r.email_subject;
          row.email_contact_summary = outboundSummary;
          row.email_contact_full = r.email_full;
          // Keep the "last contact from Qalara" date in step with the email
          // we just pulled — otherwise it keeps showing the sheet's old date
          // next to a much newer summary.
          if (r.email_date) row.last_qalara_contact = r.email_date;
          row.hubspot_email_locked = true;
        }

        const inboundSummary = inboundSummaryById.get(r.id);
        if (inboundSummary !== undefined && (r.inbound_subject || r.inbound_full)) {
          row.email_snapshot = inboundSummary;
        }
        return row;
      });
      // One request per column signature — a mixed one nulls out columns it
      // never meant to touch (see groupByColumnSignature).
      for (const group of groupByColumnSignature(chunk)) {
        const { done, fail } = await upsertChunkWithRetry(group);
        updated += done;
        failed += fail;
      }
    }

    return NextResponse.json({
      dryRun: false,
      message:
        `Synced ${updated} leads from HubSpot ` +
        `(${matched.length} matched, ${notFound.length} not found, ${skipped.length} skipped, ` +
        `${withEmail.length} email(s) pulled, ${changedOutbound.length} outbound + ` +
        `${changedInbound.length} inbound email(s) refreshed)` +
        (failed ? `, ${failed} failed to save` : "") +
        ".",
      matched: matched.length,
      notFound: notFound.length,
      skipped: skipped.length,
      withEmail: withEmail.length,
      refreshedOutbound: changedOutbound.length,
      refreshedInbound: changedInbound.length,
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
