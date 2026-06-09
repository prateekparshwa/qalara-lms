/**
 * General Discovery — the buyer-research field schema + prompt builder.
 *
 * RESEARCH_FIELDS are the columns an LLM can realistically infer from public web
 * content. Qalara-internal columns (email counts, AM, contact dates, etc.) are
 * intentionally excluded — they stay null for a freshly discovered prospect.
 */

export interface ResearchField {
  column: string;
  hint: string;
}

export const RESEARCH_FIELDS: ResearchField[] = [
  { column: "organization", hint: "Official company / brand name" },
  { column: "full_name", hint: "A key contact person, if clearly named" },
  { column: "designation", hint: "That contact's job title" },
  { column: "email", hint: "Primary contact email if shown" },
  { column: "phone", hint: "Primary phone number if shown" },
  { column: "website", hint: "Official website URL" },
  { column: "country", hint: "Headquarters country (and city if known)" },
  { column: "address", hint: "Full business address if shown" },
  {
    column: "buyer_type",
    hint: "e.g. Brick-and-mortar / Multi-channel retailer, Wholesaler / Importer, Online / E-commerce, Interior designer",
  },
  { column: "categories", hint: "Product categories they deal in (semicolon-separated)" },
  { column: "employee_size", hint: "Approx. number of employees" },
  { column: "org_scale", hint: "Org size tier (Small / Mid / Large / Enterprise)" },
  { column: "brand_description", hint: "2-3 sentence description of the brand/business" },
  { column: "materials_dealt", hint: "Materials they work with (wood, leather, textiles, etc.)" },
  { column: "customers_and_markets", hint: "Customer base and markets they serve" },
  { column: "revenue_turnover", hint: "Estimated revenue/turnover (note if unverified)" },
  { column: "competitors", hint: "Notable competitors" },
  { column: "target_audience", hint: "Who they sell to" },
  { column: "store_count", hint: "Number of stores/showrooms if a retailer" },
  { column: "import_countries", hint: "Countries they source/import from" },
  { column: "price_points", hint: "Price positioning (budget / mid / premium / luxury)" },
  { column: "imports_from_india", hint: "Do they source from India? Yes/No + detail" },
  { column: "linkedin_url", hint: "Company LinkedIn URL" },
  { column: "linkedin_followers", hint: "LinkedIn follower count" },
  { column: "instagram_handle", hint: "Instagram handle" },
  { column: "instagram_followers", hint: "Instagram follower count" },
  { column: "social_media_activity", hint: "Brief note on social presence/activity" },
  { column: "website_confidence", hint: "HIGH / MEDIUM / LOW — your confidence the website is the right, active company site" },
];

export function buildResearchSystemPrompt(): string {
  return [
    "You are a B2B buyer-research analyst for Qalara, a marketplace connecting global buyers with Indian home & lifestyle suppliers.",
    "From the provided web content, build a structured profile of the organization. Fill in as MANY fields as the content reasonably supports — aim for a complete profile, not just the obvious fields.",
    "Rules:",
    "- Return ONLY a single JSON object, no prose, no markdown fences.",
    "- Use null ONLY when the content gives no basis at all; never invent specific facts.",
    "- Reasonable inference IS allowed and encouraged: e.g. infer price_points (budget / mid-market / premium / luxury) from the product prices shown; infer buyer_type, target_audience, materials_dealt, and categories from the products and language on the site; infer org_scale from store count or employee hints.",
    "- For estimates (revenue, employees, followers), give a brief value and add '(estimate)'.",
    "- Keep each field concise (a phrase or 1-2 sentences).",
  ].join("\n");
}

export function buildResearchUserPrompt(
  inputs: { org?: string; website?: string; email?: string },
  context: string
): string {
  const fieldList = RESEARCH_FIELDS.map(
    (f) => `- "${f.column}": ${f.hint}`
  ).join("\n");
  return [
    `Inputs provided by the user:`,
    `- organization: ${inputs.org || "(unknown)"}`,
    `- website: ${inputs.website || "(unknown)"}`,
    `- email: ${inputs.email || "(unknown)"}`,
    ``,
    `Web content gathered (scrape + search results):`,
    `"""`,
    context.slice(0, 14000),
    `"""`,
    ``,
    `Return a JSON object with exactly these keys (null where unknown):`,
    fieldList,
  ].join("\n");
}
