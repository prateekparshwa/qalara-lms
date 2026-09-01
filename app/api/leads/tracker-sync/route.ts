import { NextRequest, NextResponse } from "next/server";
import { diffTrackerAgainstDb, createOrgFromTracker, loadExistingOrgKeys } from "@/lib/trackerSync";

// Each new org runs the full web-research pipeline (scrape + search + LLM +
// POC lookup) sequentially, same cost per org as one General Discovery call
// (maxDuration 60 there) — so the batch size per commit is capped well
// below what this budget can fit, with headroom for slow individual calls.
export const runtime = "nodejs";
export const maxDuration = 290;

const DEFAULT_BATCH = 5;
const MAX_BATCH = 10;

/**
 * POST /api/leads/tracker-sync[?commit=true&limit=5]
 *
 * Additive-only check against the Leads&Enqs Tracker spreadsheet (ByrMaster +
 * EnquiryTracker tabs): finds orgs with no existing Customers/Engagement
 * record and, once confirmed, creates them via web research — never touches
 * or deletes an existing lead. See lib/trackerSync.ts for the matching and
 * segment-routing rules (Order ID in EnquiryTracker -> Customers).
 *
 * Without `commit=true` this is a DRY RUN: reports the new orgs found, writes
 * nothing.
 */
export async function POST(req: NextRequest) {
  const commit = req.nextUrl.searchParams.get("commit") === "true";
  const limitParam = Number(req.nextUrl.searchParams.get("limit"));
  const limit = Math.min(
    MAX_BATCH,
    Math.max(1, Number.isFinite(limitParam) && limitParam > 0 ? limitParam : DEFAULT_BATCH)
  );

  if (!process.env.GOOGLE_SHEETS_TRACKER_ID) {
    return NextResponse.json(
      {
        message:
          "Tracker sync isn't configured yet. Set GOOGLE_SHEETS_TRACKER_ID to enable it.",
        newCount: 0,
      },
      { status: 200 }
    );
  }

  try {
    const diff = await diffTrackerAgainstDb();

    if (!commit) {
      return NextResponse.json({
        dryRun: true,
        message:
          `Found ${diff.newOrgs.length} org(s) in the tracker with no Customers/Engagement ` +
          `record yet (${diff.alreadyMatchedCount} of ${diff.totalTrackerOrgs} already matched). ` +
          `Nothing was created yet.`,
        newCount: diff.newOrgs.length,
        alreadyMatchedCount: diff.alreadyMatchedCount,
        totalTrackerOrgs: diff.totalTrackerOrgs,
        newOrgs: diff.newOrgs.map((o) => ({
          org: o.org,
          country: o.country,
          contact: o.contact,
          sources: o.sources,
          targetSegment: o.targetSegment,
        })),
      });
    }

    const batch = diff.newOrgs.slice(0, limit);
    const existing = await loadExistingOrgKeys();
    const results = [];
    for (const candidate of batch) {
      results.push(await createOrgFromTracker(candidate, existing));
    }
    const created = results.filter((r) => r.ok);
    const duplicates = results.filter((r) => !r.ok && r.duplicateOf);
    const failed = results.filter((r) => !r.ok && !r.duplicateOf);
    const remaining = diff.newOrgs.length - batch.length;

    return NextResponse.json({
      dryRun: false,
      message:
        `Created ${created.length} of ${batch.length} attempted` +
        (duplicates.length ? ` (${duplicates.length} turned out to already exist — skipped)` : "") +
        (failed.length ? ` (${failed.length} failed)` : "") +
        (remaining > 0
          ? `. ${remaining} more new org(s) still pending — run Tracker Sync again to continue.`
          : ". No more new orgs pending."),
      created: created.length,
      duplicates: duplicates.length,
      failed: failed.length,
      remaining,
      results,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Tracker sync failed for an unknown reason." },
      { status: 500 }
    );
  }
}
