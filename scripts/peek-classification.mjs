// One-off: inspect the two classification columns in the live sheet.
import { readFileSync } from "fs";
import { google } from "googleapis";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const get = (n) => {
  let v = env.match(new RegExp(`^${n}=(.*)$`, "m"))[1].trim();
  return v.startsWith("'") ? v.slice(1, -1) : v;
};
const creds = JSON.parse(get("GOOGLE_SERVICE_ACCOUNT_JSON"));
const auth = new google.auth.JWT({
  email: creds.client_email,
  key: creds.private_key.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});
const sheets = google.sheets({ version: "v4", auth });
const r = await sheets.spreadsheets.values.get({
  spreadsheetId: get("GOOGLE_SHEETS_SPREADSHEET_ID"),
  range: "Sheet1!2:30",
});
const rows = r.data.values ?? [];
const norm = (h) => String(h ?? "").trim().replace(/\s*\(\d+\)$/, "").trim();
const headers = rows[0].map(norm);
const idxA = headers.indexOf("Buyer Classification");
const idxB = headers.indexOf("AI Classification of Buyer");
console.log(`"Buyer Classification" at index ${idxA}; "AI Classification of Buyer" at index ${idxB}`);
console.log(`raw headers: A="${rows[0][idxA]}", B="${rows[0][idxB]}"`);
for (let i = 1; i < Math.min(rows.length, 12); i++) {
  console.log(`row${i + 1}: org="${rows[i][1]}" | BuyerClass="${rows[i][idxA] ?? ""}" | AIClass="${rows[i][idxB] ?? ""}"`);
}
