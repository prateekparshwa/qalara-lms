/**
 * One-time import: Leads_Final_COMPLETE_v8_cleaned.xlsx → Supabase
 *
 * Usage:
 *   npx tsx scripts/import-leads.ts
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import * as XLSX from "xlsx";
import * as path from "path";
import * as fs from "fs";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FILE_PATH =
  process.env.EXCEL_PATH ??
  path.resolve(
    "C:\\Users\\Prateek - Qalara\\Qalara HiPo Analysis\\Final Files\\Leads_Final_COMPLETE_v8_cleaned.xlsx"
  );

function clean(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" || s === "null" || s === "undefined" ? null : s;
}

async function main() {
  console.log("Reading:", FILE_PATH);
  if (!fs.existsSync(FILE_PATH)) {
    console.error("File not found:", FILE_PATH);
    process.exit(1);
  }

  const wb = XLSX.readFile(FILE_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, {
    defval: null,
    raw: false,
  });

  console.log(`Found ${raw.length} rows. Importing into Supabase…`);

  const rows = raw.map((r) => ({
    source: clean(r["Source"]),
    organization: clean(r["Organization"]),
    full_name: clean(r["Full Name"]),
    designation: clean(r["Designation"]),
    phone: clean(r["Phone"]),
    email: clean(r["Email"]),
    website: clean(r["Website"]),
    country: clean(r["Country"]),
    address: clean(r["Address"]),
    buyer_type: clean(r["Buyer_Type"]),
    categories: clean(r["Categories"]),
    employee_size: clean(r["Employee_Size"]),
    org_scale: clean(r["Org_Scale"]),
    brand_description: clean(r["Brand_Description"]),
    materials_dealt: clean(r["Materials_Dealt"]),
    customers_and_markets: clean(r["Customers_And_Markets Present In"]),
    revenue_turnover: clean(r["Potential Revenue_Turnover"]),
    competitors: clean(r["Competitors of the Buyer"]),
    target_audience: clean(r["Target_Audience"]),
    store_count: clean(r["Count of Stores of the buyer"]),
    import_countries: clean(r["Import_Countries"]),
    price_points: clean(r["Price_Points"]),
    imports_from_india: clean(r["Imports_From_India"]),
    linkedin_url: clean(r["LinkedIn_URL"]),
    linkedin_followers: clean(r["LinkedIn_Followers"]),
    instagram_handle: clean(r["Instagram_Handle"]),
    instagram_followers: clean(r["Instagram_Followers"]),
    social_media_activity: clean(r["Social_Media_Activity"]),
    first_contact_date: clean(
      r["First_Contact_Date from buyer(yyyy-mm-dd)"]
    ),
    last_contact_date: clean(
      r["Last_Contact_Date from buyer(yyyy-mm-dd)"]
    ),
    email_snapshot: clean(
      r["Last Email received from buyer (Email Snapshot)"]
    ),
    current_am: clean(r["Current AM(Account Manager)"]),
    last_qalara_contact: clean(
      r["Last Contact Date from Qalara to buyer(yyyy-mm-dd)"]
    ),
    last_email_subject: clean(
      r["Subject of the last email sent from Qalara to buyer"]
    ),
    email_contact_summary: clean(r["EMAIL_Last_Contact_Summary"]),
    sourcing_emails_low: clean(
      r["Emails received (2 or less) from buyer in sourcing@qalara"]
    ),
    sourcing_emails_mid: clean(
      r["Emails received (3-7) from buyer in soucing@qalara.com"]
    ),
    sourcing_emails_high: clean(r["8+ "]),
    quotations_request: clean(r["Quotations Request"]),
    samples_request: clean(r["Samples Request"]),
    buyers_emails_low: clean(
      r["Emails (2 or less) from buyer in buyers@qalara.com"]
    ),
    buyers_emails_mid: clean(r["3 to 7"]),
    buyers_emails_high: clean(r["8 or more"]),
    quotations: clean(r["Quotations"]),
    samples: clean(r["Samples"]),
    buyer_classification: clean(r["Buyer Classification"]),
    full_name_original: clean(r["Full_Name_Original"]),
    website_confidence: clean(
      r["Website_Confidence (Claude verification)"]
    ),
    raw_data: r,
  }));

  const CHUNK = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from("leads").insert(chunk);

    if (error) {
      console.error(`\nError at chunk ${i}:`, error.message);
    } else {
      inserted += chunk.length;
      process.stdout.write(`\r  Inserted ${inserted}/${rows.length}`);
    }
  }

  console.log(`\nDone! ${inserted} rows imported successfully.`);
}

main().catch(console.error);
