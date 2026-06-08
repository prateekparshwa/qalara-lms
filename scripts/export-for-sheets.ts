/**
 * Seed export: current Supabase `leads` -> .xlsx ready to import into Google Sheets.
 *
 * Produces a file whose header row exactly matches lib/sheet-schema.ts, so the
 * "Sync now" button can read it straight back with no column drift.
 *
 * Usage:
 *   npx tsx scripts/export-for-sheets.ts
 *
 * Output:
 *   .tmp/qalara-leads-for-sheets.xlsx
 */

import * as XLSX from "xlsx";
import * as path from "path";
import * as fs from "fs";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { SHEET_COLUMNS, SHEET_HEADERS } from "../lib/sheet-schema";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PAGE = 1000; // Supabase caps a single select at 1000 rows.

async function fetchAll(): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const to = from + PAGE - 1;
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("id", { ascending: true })
      .range(from, to);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all.push(...(data as Record<string, unknown>[]));
    process.stdout.write(`\r  Fetched ${all.length} rows`);
    if (data.length < PAGE) break;
  }
  process.stdout.write("\n");
  return all;
}

async function main() {
  console.log("Reading leads from Supabase…");
  const leads = await fetchAll();
  console.log(`Got ${leads.length} leads. Building spreadsheet…`);

  // Build rows as arrays in the exact SHEET_HEADERS order.
  const aoa: unknown[][] = [SHEET_HEADERS];
  for (const lead of leads) {
    aoa.push(
      SHEET_COLUMNS.map((c) => {
        const v = lead[c.column];
        return v === null || v === undefined ? "" : v;
      })
    );
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Leads");

  const outDir = path.resolve(__dirname, "../.tmp");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "qalara-leads-for-sheets.xlsx");
  XLSX.writeFile(wb, outPath);

  console.log(`\nDone. Wrote ${leads.length} rows + header to:\n  ${outPath}`);
  console.log(`\nColumns (${SHEET_HEADERS.length}): ${SHEET_HEADERS.join(", ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
