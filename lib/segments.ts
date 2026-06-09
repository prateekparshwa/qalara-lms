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
    definition: "Buyers Qalara reached out to who haven't responded yet.",
    envVars: ["GOOGLE_SHEETS_SPREADSHEET_ID_NO_ENGAGEMENT"],
  },
  {
    key: "prospects",
    label: "Prospects",
    definition: "Potential buyers not yet contacted by anyone.",
    envVars: ["GOOGLE_SHEETS_SPREADSHEET_ID_PROSPECTS"],
  },
  {
    key: "customers",
    label: "Qalara Customers",
    definition: "Buyers who have placed at least one order.",
    envVars: ["GOOGLE_SHEETS_SPREADSHEET_ID_CUSTOMERS"],
    deferred: true,
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
