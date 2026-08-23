import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { hubspotConfigured, pullHubspotDataForLeads } from "@/lib/hubspot";

// Batched HubSpot calls need the Node.js runtime (not edge). 60 is Vercel
// Hobby's hard cap — the deal-stage/email/company lookups run concurrently
// (see Promise.allSettled in pullHubspotDataForLeads) specifically so the
// whole sync fits inside this, despite the email pull not being batchable
// the way the rollup fields are.
export const runtime = "nodejs";
export const maxDuration = 60;

const PAGE = 1000;
const WRITE_CHUNK = 500;

interface LeadRow {
  id: number;
  email: string | null;
  website: string | null;
}

/**
 * POST /api/leads/hubspot-sync?segment=customers[&commit=true]
 *
 * Read-only pull from HubSpot (Contacts by email, Companies by domain, plus a
 * best-effort deal stage) — nothing is ever written back to HubSpot. Without
 * `commit=true` this is a DRY RUN: it reports match counts but writes nothing
 * to Supabase, so the first sync against ~1000+ live Customers leads can be
 * previewed before anything changes.
 */
export async function POST(req: NextRequest) {
  const segment = req.nextUrl.searchParams.get("segment") ?? "";
  const commit = req.nextUrl.searchParams.get("commit") === "true";

  // Scoped to Customers only for now — the largest segments (engagement /
  // no_engagement / prospects) are thousands of unqualified leads that
  // shouldn't be matched against a live sales CRM yet.
  if (segment !== "customers") {
    return NextResponse.json(
      {
        message: "HubSpot sync is only enabled for the Customers segment right now.",
        matched: 0,
        notFound: 0,
        skipped: 0,
      },
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
    // 1. Read every Customers lead's id/email/website (paginated).
    const rows: LeadRow[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabaseAdmin
        .from("leads")
        .select("id,email,website")
        .eq("segment", segment)
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      const page = (data ?? []) as LeadRow[];
      rows.push(...page);
      if (page.length < PAGE) break;
    }

    if (rows.length === 0) {
      return NextResponse.json({
        message: "No Customers leads found to sync.",
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
    const withEmail = results.filter((r) => r.email_subject || r.email_summary);

    if (!commit) {
      return NextResponse.json({
        dryRun: true,
        message:
          `Dry run: would match ${matched.length} of ${rows.length} Customers leads in HubSpot ` +
          `(${notFound.length} not found, ${skipped.length} skipped — no email or website on file), ` +
          `${withEmail.length} with a HubSpot email to pull into last_email_subject/email_contact_summary ` +
          `(this locks those fields against the next Sheets sync). Nothing was written yet.`,
        matched: matched.length,
        notFound: notFound.length,
        skipped: skipped.length,
        withEmail: withEmail.length,
        total: rows.length,
      });
    }

    // 3. Commit — batched upsert. Rollup columns are always written for every
    // row; last_email_subject/email_contact_summary/hubspot_email_locked are
    // only included (and only then locked) for rows where a HubSpot email was
    // actually found, so a miss never blanks out the sheet's existing value.
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
        if (r.email_subject || r.email_summary) {
          row.last_email_subject = r.email_subject;
          row.email_contact_summary = r.email_summary;
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

    return NextResponse.json({
      dryRun: false,
      message:
        `Synced ${updated} Customers leads from HubSpot ` +
        `(${matched.length} matched, ${notFound.length} not found, ${skipped.length} skipped, ` +
        `${withEmail.length} email(s) pulled)` +
        (failed ? `, ${failed} failed to save` : "") +
        ".",
      matched: matched.length,
      notFound: notFound.length,
      skipped: skipped.length,
      withEmail: withEmail.length,
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
