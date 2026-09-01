/**
 * Google Sheets reader (service-account auth, read-only).
 *
 * Reads a spreadsheet tab and maps each row to a partial `leads` record using
 * lib/sheet-schema.ts. Runs server-side only (Node runtime) — never import
 * this into client components.
 *
 * Required env vars:
 *   GOOGLE_SHEETS_SPREADSHEET_ID   — the id from the sheet URL
 *   GOOGLE_SERVICE_ACCOUNT_JSON    — the full service-account key JSON (verbatim)
 *
 * Most segments live in their own spreadsheet (first tab read by default).
 * A segment can instead point at a specific TAB within a shared spreadsheet
 * (e.g. Customers is a second tab in the Engagement workbook, with its own
 * header names) via the `sheetTitle` / `headerToColumn` options below.
 */

import { google } from "googleapis";
import { HEADER_TO_COLUMN } from "./sheet-schema";
import { normalizeCountry, normalizeOrgScale, normalizeBuyerType, sanitizeAmValue } from "./format";

export interface SheetReadResult {
  /** Title of the tab that was read. */
  sheetTitle: string;
  /** One object per data row, keyed by db column (only mapped headers). */
  rows: Record<string, string | null>[];
  /** Headers found in the sheet that we don't recognise (ignored, surfaced for diagnostics). */
  unknownHeaders: string[];
  /** Expected db columns whose header was missing from the sheet. */
  missingHeaders: string[];
}

/** Column-header names to match on for the AM write-back — differs per tab
 * (Engagement vs Customers use different header text for the same concept). */
export interface MatchColumns {
  org: string;
  email: string;
  am: string;
}

const DEFAULT_MATCH_COLUMNS: MatchColumns = {
  org: "Buyer Organization Name",
  email: "Buyer Email ID(s)",
  am: "Current AM(Account Manager)",
};

function getCredentials(): { client_email: string; private_key: string } {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw || !raw.trim()) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON is not set. Add the service-account key JSON to the environment."
    );
  }
  let parsed: { client_email?: string; private_key?: string };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON. Paste the entire downloaded key file."
    );
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON is missing client_email or private_key."
    );
  }
  // Vercel / shells sometimes store the key with escaped newlines.
  const private_key = parsed.private_key.replace(/\\n/g, "\n");
  return { client_email: parsed.client_email, private_key };
}

/** Normalize a sheet header for matching: trim and strip a trailing
 * " (1234)" count suffix (the sheet now annotates headers with fill counts). */
function normalizeHeader(h: unknown): string {
  return String(h ?? "")
    .trim()
    .replace(/\s*\(\d+\)$/, "")
    .trim();
}

// Columns where "0" is a real, meaningful count (e.g. "0 emails received") —
// never treat it as a missing-data placeholder for these.
const ZERO_IS_VALID_COLUMNS = new Set([
  "sourcing_emails_low",
  "sourcing_emails_mid",
  "sourcing_emails_high",
  "buyers_emails_low",
  "buyers_emails_mid",
  "buyers_emails_high",
  "quotations_request",
  "samples_request",
  "quotations",
  "samples",
  "store_count", // "0 stores" is a real answer for an online-only buyer.
]);

function clean(v: unknown, column?: string): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  // A bare "0" shows up in source data (ByrMaster org profiles, signup
  // dumps) as a data-entry placeholder for "nothing here" — e.g. Business
  // Type recorded as the text "0". None of the descriptive fields are ever
  // legitimately just "0", so treat it as blank there. The email/quotation
  // count columns are the opposite: "0" is a real, meaningful count, so
  // they're explicitly exempted above.
  const isPlaceholderZero = s === "0" && !(column && ZERO_IS_VALID_COLUMNS.has(column));
  return s === "" ||
    s.toLowerCase() === "null" ||
    s.toLowerCase() === "undefined" ||
    isPlaceholderZero
    ? null
    : s;
}

/** 0-based column index -> A1 letters (0 = A, 26 = AA). */
function columnLetter(index: number): string {
  let s = "";
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * Resolve which tab to read/write: an exact title match when `wantedTitle` is
 * given (throws a clear error if that tab doesn't exist — most likely a typo
 * or a renamed tab), else the spreadsheet's first tab (existing behaviour).
 */
async function resolveSheetTitle(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  wantedTitle?: string
): Promise<string> {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title",
  });
  const titles = (meta.data.sheets ?? [])
    .map((s) => s.properties?.title)
    .filter((t): t is string => !!t);
  if (titles.length === 0) {
    throw new Error("Could not find any tab in the spreadsheet.");
  }
  if (!wantedTitle) return titles[0];
  const match = titles.find((t) => t === wantedTitle);
  if (!match) {
    throw new Error(
      `Tab "${wantedTitle}" not found in the spreadsheet (tabs present: ${titles.join(", ")}).`
    );
  }
  return match;
}

/**
 * Write a new Account Manager into the sheet row matching this lead.
 * Matches by organization name (and email when several rows share the name).
 * Requires the service account to have EDITOR access on the spreadsheet.
 */
export async function updateLeadAmInSheet(
  spreadsheetIdArg: string | undefined,
  match: { organization: string | null; email: string | null },
  newAm: string,
  opts?: { sheetTitle?: string; headerToColumn?: Record<string, string>; matchColumns?: MatchColumns }
): Promise<void> {
  const spreadsheetId =
    spreadsheetIdArg?.trim() || process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error("No spreadsheet id configured.");
  const org = (match.organization ?? "").trim().toLowerCase();
  if (!org) throw new Error("Lead has no organization name to match on.");

  const headerToColumn = opts?.headerToColumn ?? HEADER_TO_COLUMN;
  const cols = opts?.matchColumns ?? DEFAULT_MATCH_COLUMNS;

  const { client_email, private_key } = getCredentials();
  const auth = new google.auth.JWT({
    email: client_email,
    key: private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const sheetTitle = await resolveSheetTitle(sheets, spreadsheetId, opts?.sheetTitle);

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetTitle,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const values = (resp.data.values ?? []) as unknown[][];
  if (values.length === 0) throw new Error("Sheet is empty.");

  // Same header-row detection as readLeadsSheet (banner rows above headers).
  let headerIdx = 0;
  let bestMatches = -1;
  for (let i = 0; i < Math.min(values.length, 5); i++) {
    const matches = values[i]
      .map(normalizeHeader)
      .filter((h) => h in headerToColumn).length;
    if (matches > bestMatches) {
      bestMatches = matches;
      headerIdx = i;
    }
  }
  if (bestMatches === 0) throw new Error("No recognisable header row found.");
  const headerRow = values[headerIdx].map(normalizeHeader);

  const orgCol = headerRow.indexOf(cols.org);
  const emailCol = headerRow.indexOf(cols.email);
  const amCol = headerRow.indexOf(cols.am);
  if (orgCol === -1 || amCol === -1) {
    throw new Error(`Sheet is missing the "${cols.org}" or "${cols.am}" column.`);
  }

  const email = (match.email ?? "").trim().toLowerCase();
  const candidates: number[] = [];
  for (let r = headerIdx + 1; r < values.length; r++) {
    const rowOrg = String(values[r]?.[orgCol] ?? "").trim().toLowerCase();
    if (rowOrg && rowOrg === org) candidates.push(r);
  }
  if (candidates.length === 0) {
    throw new Error(`No sheet row found for "${match.organization}".`);
  }
  let rowIdx = candidates[0];
  if (candidates.length > 1 && email && emailCol !== -1) {
    const byEmail = candidates.find((r) =>
      String(values[r]?.[emailCol] ?? "").trim().toLowerCase().includes(email)
    );
    if (byEmail !== undefined) rowIdx = byEmail;
  }

  const cell = `${sheetTitle}!${columnLetter(amCol)}${rowIdx + 1}`;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: cell,
    valueInputOption: "RAW",
    requestBody: { values: [[newAm]] },
  });
}

/**
 * Bulk variant of updateLeadAmInSheet: reads the sheet ONCE and issues a single
 * batchUpdate for every matched row, instead of a full-sheet read + write per
 * lead. Matches each lead by organization (disambiguated by email when several
 * rows share the name). Best-effort: returns how many rows were written and the
 * names of any leads that had no matching sheet row.
 */
export async function updateLeadsAmInSheetBulk(
  spreadsheetIdArg: string | undefined,
  matches: { organization: string | null; email: string | null }[],
  newAm: string,
  opts?: { sheetTitle?: string; headerToColumn?: Record<string, string>; matchColumns?: MatchColumns }
): Promise<{ updated: number; unmatched: string[] }> {
  const spreadsheetId =
    spreadsheetIdArg?.trim() || process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error("No spreadsheet id configured.");
  if (matches.length === 0) return { updated: 0, unmatched: [] };

  const headerToColumn = opts?.headerToColumn ?? HEADER_TO_COLUMN;
  const cols = opts?.matchColumns ?? DEFAULT_MATCH_COLUMNS;

  const { client_email, private_key } = getCredentials();
  const auth = new google.auth.JWT({
    email: client_email,
    key: private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const sheetTitle = await resolveSheetTitle(sheets, spreadsheetId, opts?.sheetTitle);

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetTitle,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const values = (resp.data.values ?? []) as unknown[][];
  if (values.length === 0) throw new Error("Sheet is empty.");

  let headerIdx = 0;
  let bestMatches = -1;
  for (let i = 0; i < Math.min(values.length, 5); i++) {
    const m = values[i]
      .map(normalizeHeader)
      .filter((h) => h in headerToColumn).length;
    if (m > bestMatches) {
      bestMatches = m;
      headerIdx = i;
    }
  }
  if (bestMatches === 0) throw new Error("No recognisable header row found.");
  const headerRow = values[headerIdx].map(normalizeHeader);

  const orgCol = headerRow.indexOf(cols.org);
  const emailCol = headerRow.indexOf(cols.email);
  const amCol = headerRow.indexOf(cols.am);
  if (orgCol === -1 || amCol === -1) {
    throw new Error(`Sheet is missing the "${cols.org}" or "${cols.am}" column.`);
  }
  const amColLetter = columnLetter(amCol);

  const data: { range: string; values: string[][] }[] = [];
  const unmatched: string[] = [];
  // Track rows already claimed so two leads with the same org name (different
  // emails) don't both write to the first matching row.
  const usedRows = new Set<number>();

  for (const match of matches) {
    const org = (match.organization ?? "").trim().toLowerCase();
    if (!org) {
      unmatched.push(match.organization ?? "(no name)");
      continue;
    }
    const candidates: number[] = [];
    for (let r = headerIdx + 1; r < values.length; r++) {
      if (usedRows.has(r)) continue;
      const rowOrg = String(values[r]?.[orgCol] ?? "").trim().toLowerCase();
      if (rowOrg && rowOrg === org) candidates.push(r);
    }
    if (candidates.length === 0) {
      unmatched.push(match.organization ?? "(no name)");
      continue;
    }
    let rowIdx = candidates[0];
    const email = (match.email ?? "").trim().toLowerCase();
    if (candidates.length > 1 && email && emailCol !== -1) {
      const byEmail = candidates.find((r) =>
        String(values[r]?.[emailCol] ?? "").trim().toLowerCase().includes(email)
      );
      if (byEmail !== undefined) rowIdx = byEmail;
    }
    usedRows.add(rowIdx);
    data.push({
      range: `${sheetTitle}!${amColLetter}${rowIdx + 1}`,
      values: [[newAm]],
    });
  }

  if (data.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: "RAW", data },
    });
  }

  return { updated: data.length, unmatched };
}

export async function readLeadsSheet(
  spreadsheetIdArg?: string,
  opts?: { sheetTitle?: string; headerToColumn?: Record<string, string> }
): Promise<SheetReadResult> {
  const spreadsheetId =
    spreadsheetIdArg?.trim() || process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId || !spreadsheetId.trim()) {
    throw new Error("No spreadsheet id configured for this segment.");
  }

  const headerToColumn = opts?.headerToColumn ?? HEADER_TO_COLUMN;

  const { client_email, private_key } = getCredentials();
  const auth = new google.auth.JWT({
    email: client_email,
    key: private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  // Discover the target tab's title — a specific tab when opts.sheetTitle is
  // given (e.g. "Customers"), else the spreadsheet's first tab (default).
  const sheetTitle = await resolveSheetTitle(sheets, spreadsheetId, opts?.sheetTitle);

  // Pull the whole used range of that tab.
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetTitle,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });

  const values = (resp.data.values ?? []) as unknown[][];
  if (values.length === 0) {
    return { sheetTitle, rows: [], unknownHeaders: [], missingHeaders: [] };
  }

  const expectedHeaders = Object.keys(headerToColumn);

  // The header row isn't always row 1 — banner/grouping rows get inserted
  // above it. Scan the first few rows and use the one matching the schema best.
  let headerIdx = 0;
  let bestMatches = -1;
  for (let i = 0; i < Math.min(values.length, 5); i++) {
    const matches = values[i]
      .map(normalizeHeader)
      .filter((h) => h in headerToColumn).length;
    if (matches > bestMatches) {
      bestMatches = matches;
      headerIdx = i;
    }
  }
  if (bestMatches === 0) {
    throw new Error(
      "No recognisable header row found in the first 5 rows of the sheet — have the column headers been renamed?"
    );
  }
  const headerRow = values[headerIdx].map(normalizeHeader);

  const unknownHeaders = headerRow.filter(
    (h) => h !== "" && !(h in headerToColumn)
  );
  const missingHeaders = expectedHeaders.filter((h) => !headerRow.includes(h));

  // Pre-compute column index -> db column for known headers.
  const colMap: { index: number; column: string }[] = [];
  headerRow.forEach((h, i) => {
    const column = headerToColumn[h];
    if (column) colMap.push({ index: i, column });
  });

  const rows: Record<string, string | null>[] = [];
  for (let r = headerIdx + 1; r < values.length; r++) {
    const row = values[r];
    // Skip fully-blank rows.
    if (!row || row.every((c) => clean(c) === null)) continue;

    const obj: Record<string, string | null> = {};
    for (const { index, column } of colMap) {
      obj[column] = clean(row[index], column);
    }
    // Collapse known duplicate spellings ("United States (US)" etc.) to one
    // canonical name, so a filter never lists the same country twice.
    if ("country" in obj) obj.country = normalizeCountry(obj.country);
    // Reject obviously-junk AM values (leaked email subject lines, raw
    // placeholders) so the Account Manager filter never lists them.
    if ("current_am" in obj) obj.current_am = sanitizeAmValue(obj.current_am);
    // Collapse known duplicate spellings ("Medium Enterprise" vs "Medium")
    // so the Org Size Tier filter never lists the same tier twice.
    if ("org_scale" in obj) obj.org_scale = normalizeOrgScale(obj.org_scale);
    // "Unknown" -> "Not Available", the canonical "no data" label used
    // elsewhere, so the Business Type filter never lists both spellings.
    if ("buyer_type" in obj) obj.buyer_type = normalizeBuyerType(obj.buyer_type);
    // Virtual column: the AI rating wins over the legacy classification.
    if (obj.__ai_classification) {
      obj.buyer_classification = obj.__ai_classification;
    }
    delete obj.__ai_classification;
    rows.push(obj);
  }

  return { sheetTitle, rows, unknownHeaders, missingHeaders };
}
