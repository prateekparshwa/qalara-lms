/**
 * Dump the configured sheet's header row + a sample data row, so we can map
 * the columns. Read-only.
 *   npx tsx scripts/dump-headers.ts
 */
import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
import { google } from "googleapis";

async function main() {
  const parsed = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
  const auth = new google.auth.JWT({
    email: parsed.client_email,
    key: String(parsed.private_key).replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: id,
    fields: "sheets.properties.title",
  });
  const title = meta.data.sheets![0].properties!.title!;
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: id,
    range: `${title}!1:2`,
  });
  const rows = resp.data.values ?? [];
  const headers = rows[0] ?? [];
  const sample = rows[1] ?? [];
  headers.forEach((h, i) => {
    const s = String(sample[i] ?? "").slice(0, 40);
    console.log(`${i}\t${JSON.stringify(h)}\t| ${s}`);
  });
  console.log("TOTAL HEADERS:", headers.length);
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
