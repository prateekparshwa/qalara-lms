// Diff the live Google Sheet's header row against lib/sheet-schema.ts.
// Usage: node scripts/check-sheet-headers.mjs
import { readFileSync } from "fs";
import { google } from "googleapis";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
function envVar(name) {
  const m = env.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!m) throw new Error(`${name} not in .env.local`);
  let v = m[1].trim();
  if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1);
  return v;
}

const creds = JSON.parse(envVar("GOOGLE_SERVICE_ACCOUNT_JSON"));
const spreadsheetId = envVar("GOOGLE_SHEETS_SPREADSHEET_ID");

// Expected headers — keep in sync with lib/sheet-schema.ts (read from source).
const schemaSrc = readFileSync(new URL("../lib/sheet-schema.ts", import.meta.url), "utf8");
const expected = [...schemaSrc.matchAll(/header:\s*\n?\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);

const auth = new google.auth.JWT({
  email: creds.client_email,
  key: creds.private_key.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});
const sheets = google.sheets({ version: "v4", auth });

const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties.title" });
const tab = meta.data.sheets[0].properties.title;
const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${tab}!1:3` });
const rows = resp.data.values ?? [];
rows.forEach((row, i) =>
  console.log(`ROW${i + 1} [${row.length} cells]: ${row.slice(0, 5).join(" | ")}`)
);
// Pick the row that best matches the schema as the candidate header row
// (mirrors lib/google-sheets.ts: trim + strip trailing " (count)").
const norm = (h) => String(h ?? "").trim().replace(/\s*\(\d+\)$/, "").trim();
const scored = rows.map((row) => {
  const cells = row.map(norm);
  return { cells, matches: cells.filter((h) => expected.includes(h)).length };
});
const best = scored.reduce((a, b) => (b.matches > a.matches ? b : a), scored[0]);
console.log(`\nBest header-row candidate: row ${scored.indexOf(best) + 1} (${best.matches}/${expected.length} schema matches)`);
const live = best.cells;

console.log(`Tab: ${tab}`);
console.log(`Live headers: ${live.length} | Schema headers: ${expected.length}`);
const unknown = live.filter((h) => h !== "" && !expected.includes(h));
const missing = expected.filter((h) => !live.includes(h));
console.log(`\n-- In sheet but NOT in schema (won't sync) [${unknown.length}]:`);
unknown.forEach((h) => console.log(`  + "${h}"`));
console.log(`\n-- In schema but MISSING from sheet [${missing.length}]:`);
missing.forEach((h) => console.log(`  - "${h}"`));
