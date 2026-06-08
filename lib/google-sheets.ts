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

function clean(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" || s.toLowerCase() === "null" || s.toLowerCase() === "undefined"
    ? null
    : s;
}

export async function readLeadsSheet(): Promise<SheetReadResult> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId || !spreadsheetId.trim()) {
    throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID is not set.");
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

  const headerRow = values[0].map((h) => String(h ?? "").trim());
  const expectedHeaders = Object.keys(HEADER_TO_COLUMN);

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
  for (let r = 1; r < values.length; r++) {
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
