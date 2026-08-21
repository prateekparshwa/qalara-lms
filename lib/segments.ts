/**
 * Segment registry — the single source of truth for the Qalara Buyer Directory's
 * four segments. Drives the directory chooser, per-segment sync, and queries.
 *
 * Each segment is backed by its own Google Sheet (same v9 column structure).
 * A segment is "active" once its spreadsheet ID env var is set; until then the
 * chooser shows it as "coming soon" (or "deferred" for Customers).
 *
 * `envVars` is an ordered fallback list: the first one set wins. Engagement
 * falls back to the original GOOGLE_SHEETS_SPREADSHEET_ID so the current setup
 * keeps working without re-adding env vars.
 */

import { CUSTOMERS_HEADER_TO_COLUMN } from "./sheet-schema";

export type SegmentKey =
  | "engagement"
  | "no_engagement"
  | "prospects"
  | "customers";

/** Segment used to store General Discovery (Card 2) web-research results.
 * Never part of the chooser and never replaced by a sheet sync. */
export const DISCOVER_SEGMENT = "discover";

export interface Segment {
  key: SegmentKey;
  label: string;
  /** One-line definition shown in the chooser. */
  definition: string;
  /** Env vars holding this segment's Google Sheet id, in priority order. */
  envVars: string[];
  /** Deferred = intentionally not built yet (no sheet planned soon). */
  deferred?: boolean;
  /** Specific tab within the resolved spreadsheet, when a segment shares its
   * workbook with another (e.g. Customers is a second tab in the Engagement
   * spreadsheet). Omit to read the spreadsheet's first tab (default). */
  sheetTitle?: string;
}

export const SEGMENTS: Segment[] = [
  {
    key: "engagement",
    label: "Leads with Engagement",
    definition: "Buyers who have had formal communication with Qalara.",
    envVars: [
      "GOOGLE_SHEETS_SPREADSHEET_ID_ENGAGEMENT",
      "GOOGLE_SHEETS_SPREADSHEET_ID",
    ],
  },
  {
    key: "no_engagement",
    label: "Leads with No Engagement",
    definition: "Buyers who signed up but have not yet engaged or responded to Qalara.",
    envVars: ["GOOGLE_SHEETS_SPREADSHEET_ID_NO_ENGAGEMENT"],
  },
  {
    key: "prospects",
    label: "Prospects",
    definition: "Potential buyers not yet contacted by anyone.",
    envVars: ["GOOGLE_SHEETS_SPREADSHEET_ID_PROSPECTS"],
    deferred: true,
  },
  {
    key: "customers",
    label: "Qalara Customers",
    definition: "Buyers who have placed at least one order with Qalara.",
    // Lives in the SAME spreadsheet as Engagement, on its own "Customers" tab
    // — not a separate file. Falls back to the shared workbook id when a
    // dedicated one isn't set.
    envVars: [
      "GOOGLE_SHEETS_SPREADSHEET_ID_CUSTOMERS",
      "GOOGLE_SHEETS_SPREADSHEET_ID",
    ],
    sheetTitle: "Customers",
  },
];

const BY_KEY: Record<string, Segment> = Object.fromEntries(
  SEGMENTS.map((s) => [s.key, s])
);

export function getSegment(key: string): Segment | undefined {
  return BY_KEY[key];
}

export function isSegmentKey(key: string): key is SegmentKey {
  return key in BY_KEY;
}

/** Resolve a segment's configured spreadsheet id from its env vars (first set wins). */
export function segmentSpreadsheetId(seg: Segment): string | undefined {
  for (const name of seg.envVars) {
    const v = process.env[name];
    if (v && v.trim()) return v.trim();
  }
  return undefined;
}

/** Segments that are live (linked to a sheet, not deferred) — the ones a
 * cross-segment directory search actually has data for. */
export function activeSegmentKeys(): SegmentKey[] {
  return SEGMENTS.filter((s) => !s.deferred && !!segmentSpreadsheetId(s)).map(
    (s) => s.key
  );
}

/**
 * Sheet read/write options for a segment that lives in a shared workbook
 * under its own tab with its own header names (currently only Customers).
 * Centralised here so sync and both AM-assign routes agree on the same
 * tab + header map + match-column names instead of repeating the special
 * case in three places.
 */
export function sheetOptionsFor(seg: Segment): {
  sheetTitle?: string;
  headerToColumn?: Record<string, string>;
  matchColumns?: { org: string; email: string; am: string };
} {
  if (seg.key === "customers") {
    return {
      sheetTitle: seg.sheetTitle,
      headerToColumn: CUSTOMERS_HEADER_TO_COLUMN,
      matchColumns: { org: "Organization Name", email: "Email", am: "AM(Account Manager)" },
    };
  }
  return { sheetTitle: seg.sheetTitle };
}
