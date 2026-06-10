/**
 * Mapping between the live Google Sheet's columns and the database columns.
 *
 * `header` is the exact text in row 1 of the sheet (trimmed); `column` is the
 * matching column in the Supabase `leads` table. lib/google-sheets.ts uses this
 * to turn each sheet row into a db record during "Sync".
 *
 * Columns in the sheet that aren't listed here (e.g. "Unnamed: 30",
 * "AI Classification of Buyer") are simply ignored.
 */
export interface SheetColumn {
  header: string;
  column: string;
}

export const SHEET_COLUMNS: SheetColumn[] = [
  { header: "Lead Source", column: "source" },
  { header: "Buyer Organization Name", column: "organization" },
  { header: "Buyer Full Name", column: "full_name" },
  { header: "Buyer Designation", column: "designation" },
  { header: "Buyer Phone #", column: "phone" },
  { header: "Buyer Email ID(s)", column: "email" },
  { header: "Buyer Brand Website URL", column: "website" },
  { header: "Buyer Country", column: "country" },
  { header: "Buyer Full Address", column: "address" },
  { header: "Buyer Business_Type", column: "buyer_type" },
  { header: "Categories Buyer deals In", column: "categories" },
  { header: "No. of Employees in Buyers Org", column: "employee_size" },
  { header: "Buyer Org Size Tier", column: "org_scale" },
  { header: "Buyer Brand_Description", column: "brand_description" },
  { header: "Materials_Dealt In", column: "materials_dealt" },
  {
    header: "Customers_And_Markets buyer is Present In",
    column: "customers_and_markets",
  },
  { header: "Potential Revenue_Turnover", column: "revenue_turnover" },
  { header: "Competitors of the Buyer", column: "competitors" },
  { header: "Target_Audience of the buyer", column: "target_audience" },
  { header: "Count of Stores of the buyer", column: "store_count" },
  { header: "Sourcing_Countries of the buyer", column: "import_countries" },
  { header: "Retail Price_Points", column: "price_points" },
  { header: "Sources_From_India ?", column: "imports_from_india" },
  { header: "LinkedIn_URL of the buyer", column: "linkedin_url" },
  { header: "LinkedIn_Followers of the buyer", column: "linkedin_followers" },
  {
    header: "Instagram Handle or FB Page of the Buyer/Org",
    column: "instagram_handle",
  },
  {
    header: "Instagram_Followers of the Buyer/Org Page",
    column: "instagram_followers",
  },
  { header: "Social_Media_Activity of the buyer", column: "social_media_activity" },
  {
    header: "First_Contact_Date from buyer(yyyy-mm-dd)",
    column: "first_contact_date",
  },
  {
    header: "Last_Contact_Date from buyer(yyyy-mm-dd)",
    column: "last_contact_date",
  },
  {
    header: "Last Email received from buyer (Email Snapshot)",
    column: "email_snapshot",
  },
  { header: "Current AM(Account Manager)", column: "current_am" },
  {
    header: "Last Contact Date from Qalara to buyer(yyyy-mm-dd)",
    column: "last_qalara_contact",
  },
  {
    header: "Subject of the last email sent from Qalara to buyer",
    column: "last_email_subject",
  },
  {
    header: "Last Email Summary from Qalara to Buyer",
    column: "email_contact_summary",
  },
  {
    header: "Emails received (2 or less) from buyer in sourcing@qalara",
    column: "sourcing_emails_low",
  },
  {
    header: "Emails received (3-7) from buyer in soucing@qalara",
    column: "sourcing_emails_mid",
  },
  {
    header: "Emails received (8+) from buyer in soucing@qalara.com",
    column: "sourcing_emails_high",
  },
  {
    header:
      "Quotations or similar keywords Requested by the buyer in sourcing@qalara inbox",
    column: "quotations_request",
  },
  {
    header:
      "Samples or similar keywords Requested by the buyer in sourcing@qalara inbox",
    column: "samples_request",
  },
  {
    header: "Emails (2 or less) from buyer in buyers@qalara.com",
    column: "buyers_emails_low",
  },
  {
    header: "Emails received (3-7) from buyer in buyers@qalara.com",
    column: "buyers_emails_mid",
  },
  {
    header: "Emails received 8+ from buyer in buyers@qalara.com",
    column: "buyers_emails_high",
  },
  {
    header:
      "Quotations or similar keywords Requested by the buyer in buyers@qalara inbox",
    column: "quotations",
  },
  {
    header:
      "Samples or similar keywords Requested by the buyer in buyers@qalara inbox",
    column: "samples",
  },
  { header: "Buyer Classification", column: "buyer_classification" },
  // Newer AI-rated HIGH/MEDIUM/LOW — preferred over Buyer Classification when
  // filled. The __ prefix marks it virtual: google-sheets.ts merges it into
  // buyer_classification instead of writing it to the db.
  { header: "AI Classification of Buyer", column: "__ai_classification" },
  { header: "Full_Name_Original", column: "full_name_original" },
  { header: "Website_Confidence (Claude verification)", column: "website_confidence" },
];

/** Ordered list of sheet headers (row 1). */
export const SHEET_HEADERS = SHEET_COLUMNS.map((c) => c.header);

/** Lookup: sheet header -> db column. */
export const HEADER_TO_COLUMN: Record<string, string> = Object.fromEntries(
  SHEET_COLUMNS.map((c) => [c.header, c.column])
);
