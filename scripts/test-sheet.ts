/**
 * Quick connection test: reads the configured Google Sheet and reports what
 * it found. Does NOT touch the database.
 *
 *   npx tsx scripts/test-sheet.ts
 */
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

async function main() {
  const { readLeadsSheet } = await import("../lib/google-sheets");
  const res = await readLeadsSheet();
  console.log("Sheet tab:        ", res.sheetTitle);
  console.log("Data rows:        ", res.rows.length);
  console.log("Unknown headers:  ", res.unknownHeaders.length, res.unknownHeaders.slice(0, 5));
  console.log("Missing headers:  ", res.missingHeaders.length, res.missingHeaders.slice(0, 5));
  console.log("First row sample: ", JSON.stringify(res.rows[0] ?? null).slice(0, 300));
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
