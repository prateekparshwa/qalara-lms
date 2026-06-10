/**
 * Google Sheets reader (service-account auth, read-only).
 *
 * Reads the configured spreadsheet's first tab and maps each row to a
 * partial `leads` record using lib/sheet-schema.ts. Runs server-side only
 * (Node runtime) — never import this into client components.
 *
 * Required env vars:
 *   GOOGLE_SHEETS_SPREADSHEET_ID   — the id from the sheet URL
 *   GOOGLE_SERVICE_ACCOUNT_JSON    — the full service-account key JSON (verbatim)
 */

import { google } from "googleapis";
import { HEADER_TO_COLUMN } from "./sheet-schema";

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

function clean(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" || s.toLowerCase() === "null" || s.toLowerCase() === "undefined"
    ? null
    : s;
}

export async function readLeadsSheet(
  spreadsheetIdArg?: string
): Promise<SheetReadResult> {
  const spreadsheetId =
    spreadsheetIdArg?.trim() || process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId || !spreadsheetId.trim()) {
    throw new Error("No spreadsheet id configured for this segment.");
  }

  const { client_email, private_key } = getCredentials();
  const auth = new google.auth.JWT({
    email: client_email,
    key: private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  // Discover the first tab's title so we don't hard-code "Sheet1" vs "Leads".
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title",
  });
  const sheetTitle = meta.data.sheets?.[0]?.properties?.title;
  if (!sheetTitle) {
    throw new Error("Could not find any tab in the spreadsheet.");
  }

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

  const expectedHeaders = Object.keys(HEADER_TO_COLUMN);

  // The header row isn't always row 1 — banner/grouping rows get inserted
  // above it. Scan the first few rows and use the one matching the schema best.
  let headerIdx = 0;
  let bestMatches = -1;
  for (let i = 0; i < Math.min(values.length, 5); i++) {
    const matches = values[i]
      .map(normalizeHeader)
      .filter((h) => h in HEADER_TO_COLUMN).length;
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
    (h) => h !== "" && !(h in HEADER_TO_COLUMN)
  );
  const missingHeaders = expectedHeaders.filter((h) => !headerRow.includes(h));

  // Pre-compute column index -> db column for known headers.
  const colMap: { index: number; column: string }[] = [];
  headerRow.forEach((h, i) => {
    const column = HEADER_TO_COLUMN[h];
    if (column) colMap.push({ index: i, column });
  });

  const rows: Record<string, string | null>[] = [];
  for (let r = headerIdx + 1; r < values.length; r++) {
    const row = values[r];
    // Skip fully-blank rows.
    if (!row || row.every((c) => clean(c) === null)) continue;

    const obj: Record<string, string | null> = {};
    for (const { index, column } of colMap) {
      obj[column] = clean(row[index]);
    }
    rows.push(obj);
  }

  return { sheetTitle, rows, unknownHeaders, missingHeaders };
}
