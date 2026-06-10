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
  {
    column: "store_count",
    hint: "Number of stores/showrooms with the source in brackets, e.g. '120 stores (company website /stores page)'; only if no source exists, give a number clearly marked '(estimate)'",
  },
  {
    column: "import_countries",
    hint: "Countries they source/import from, each claim with its source in brackets — null if no source found; never guess",
  },
  {
    column: "price_points",
    hint: "Price positioning (budget / mid / premium / luxury) overall AND per subcategory — when a website is available cover AT LEAST 3-4 main subcategories, each with its source in brackets, e.g. 'Cushions: premium (website product pages); Rugs: mid (website); Lighting: premium (website); Tableware: mid (website)'",
  },
  {
    column: "imports_from_india",
    hint: "Do they source from India? Yes/No + detail, with the source in brackets — null if no source found; never guess",
  },
  {
    column: "linkedin_url",
    hint: "LinkedIn URL — the key contact person's profile first if known, then the company page after ' / '",
  },
  { column: "linkedin_followers", hint: "LinkedIn follower count" },
  {
    column: "instagram_handle",
    hint: "Instagram handle or Facebook page — the contact person's first if known, else the company's marked '(company)'",
  },
  { column: "instagram_followers", hint: "Instagram follower count" },
  {
    column: "social_media_activity",
    hint: "Brief note on social presence/activity incl. Facebook page if found — the person's page first, else the company's marked '(company)'",
  },
  { column: "website_confidence", hint: "HIGH / MEDIUM / LOW — your confidence the website is the right, active company site" },
];

export function buildResearchSystemPrompt(): string {
  return [
    "You are a B2B buyer-research analyst for Qalara, a marketplace connecting global buyers with Indian home & lifestyle suppliers.",
    "From the provided web content, build a structured profile of the organization. Be COMPREHENSIVE: work through every field and fill in as many as the content reasonably supports — a thin profile with only the obvious fields is a failure.",
    "Actively look for the brand's social profiles (Instagram handle, LinkedIn URL, Facebook page) in the search results — these are frequently present and must not be missed.",
    "Rules:",
    "- Return ONLY a single JSON object, no prose, no markdown fences.",
    "- Use null ONLY when the content gives no basis at all; never invent specific facts.",
    "- Reasonable inference IS allowed and encouraged: e.g. infer price_points (budget / mid-market / premium / luxury) from the product prices shown; infer buyer_type, target_audience, materials_dealt, and categories from the products and language on the site; infer org_scale from store count or employee hints.",
    "- For estimates (revenue, employees, followers), give a brief value and add '(estimate)'.",
    "- SOURCING IS MANDATORY for trade facts: store_count, import_countries, imports_from_india, price_points, and revenue_turnover must each cite WHERE the claim comes from in brackets after the value, e.g. '(company website /stores page)', '(LinkedIn)', '(press release via search)'. A number or claim with no source is worse than null — never write 'it imports' or a count without evidence. Only store_count and revenue_turnover may fall back to a clearly marked '(estimate)' when no source exists; import_countries and imports_from_india must be null without a source.",
    "- Keep each field concise (a phrase or 1-2 sentences).",
  ].join("\n");
}

export function buildResearchUserPrompt(
  inputs: {
    org?: string;
    website?: string;
    email?: string;
    buyerName?: string;
    country?: string;
  },
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
    `- buyer/contact person name: ${inputs.buyerName || "(unknown)"}`,
    `- country: ${inputs.country || "(unknown)"}`,
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
