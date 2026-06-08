import { supabaseAdmin } from "./supabase";

// All query helpers run server-side (in API routes only), so we use the
// admin client. RLS stays enabled, blocking any direct anon/browser access.
const supabase = supabaseAdmin;

export interface Lead {
  id: number;
  source: string | null;
  organization: string | null;
  full_name: string | null;
  designation: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  country: string | null;
  address: string | null;
  buyer_type: string | null;
  categories: string | null;
  employee_size: string | null;
  org_scale: string | null;
  brand_description: string | null;
  materials_dealt: string | null;
  customers_and_markets: string | null;
  revenue_turnover: string | null;
  competitors: string | null;
  target_audience: string | null;
  store_count: string | null;
  import_countries: string | null;
  price_points: string | null;
  imports_from_india: string | null;
  linkedin_url: string | null;
  linkedin_followers: string | null;
  instagram_handle: string | null;
  instagram_followers: string | null;
  social_media_activity: string | null;
  first_contact_date: string | null;
  last_contact_date: string | null;
  email_snapshot: string | null;
  current_am: string | null;
  last_qalara_contact: string | null;
  last_email_subject: string | null;
  email_contact_summary: string | null;
  sourcing_emails_low: string | null;
  sourcing_emails_mid: string | null;
  sourcing_emails_high: string | null;
  quotations_request: string | null;
  samples_request: string | null;
  buyers_emails_low: string | null;
  buyers_emails_mid: string | null;
  buyers_emails_high: string | null;
  quotations: string | null;
  samples: string | null;
  buyer_classification: string | null;
  full_name_original: string | null;
  website_confidence: string | null;
  enrichment_cache: Record<string, unknown> | null;
  imported_at: string | null;
  enriched_at: string | null;
}

export interface LeadsQueryParams {
  q?: string;
  org?: string;
  email?: string;
  website?: string;
  country?: string;
  buyer_type?: string;
  classification?: string;
  am?: string;
  confidence?: string;
  page?: number;
  limit?: number;
  sort?: string;
  order?: "asc" | "desc";
}

export interface LeadsResult {
  data: Lead[];
  total: number;
  page: number;
  limit: number;
}

export async function getLeads(params: LeadsQueryParams): Promise<LeadsResult> {
  const {
    q = "",
    org,
    email,
    website,
    country,
    buyer_type,
    classification,
    am,
    confidence,
    page = 1,
    limit = 50,
    sort = "organization",
    order = "asc",
  } = params;

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase.from("leads").select("*", { count: "exact" });

  // Free-text search across org, email, website (legacy single-field)
  if (q && q.trim()) {
    const term = q.trim();
    query = query.or(
      `organization.ilike.%${term}%,email.ilike.%${term}%,website.ilike.%${term}%,full_name.ilike.%${term}%`
    );
  }

  // Dedicated per-field search (combined with AND)
  if (org && org.trim())
    query = query.ilike("organization", `%${org.trim()}%`);
  if (email && email.trim())
    query = query.ilike("email", `%${email.trim()}%`);
  if (website && website.trim())
    query = query.ilike("website", `%${website.trim()}%`);

  if (country) query = query.eq("country", country);
  if (buyer_type) query = query.ilike("buyer_type", `%${buyer_type}%`);
  if (classification) query = query.ilike("buyer_classification", `%${classification}%`);
  if (am) query = query.ilike("current_am", `%${am}%`);
  if (confidence) query = query.ilike("website_confidence", `%${confidence}%`);

  query = query.order(sort, { ascending: order === "asc" }).range(from, to);

  const { data, error, count } = await query;

  if (error) throw new Error(error.message);

  return {
    data: (data as Lead[]) ?? [],
    total: count ?? 0,
    page,
    limit,
  };
}

export async function getLeadById(id: number): Promise<Lead | null> {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data as Lead;
}

export async function getLeadStats() {
  const { count: total } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true });

  const { count: verified } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .not("website", "is", null)
    .neq("website", "");

  const { count: highConf } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .ilike("website_confidence", "%HIGH%");

  const { count: highClass } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .ilike("buyer_classification", "%HIGH%");

  return {
    total: total ?? 0,
    verified: verified ?? 0,
    highConfidence: highConf ?? 0,
    highClassification: highClass ?? 0,
  };
}

export async function getFilterOptions() {
  const [countries, buyerTypes, classifications, ams] = await Promise.all([
    supabase
      .from("leads")
      .select("country")
      .not("country", "is", null)
      .neq("country", "")
      .order("country"),
    supabase
      .from("leads")
      .select("buyer_type")
      .not("buyer_type", "is", null)
      .neq("buyer_type", "")
      .order("buyer_type"),
    supabase
      .from("leads")
      .select("buyer_classification")
      .not("buyer_classification", "is", null)
      .neq("buyer_classification", "")
      .order("buyer_classification"),
    supabase
      .from("leads")
      .select("current_am")
      .not("current_am", "is", null)
      .neq("current_am", "")
      .order("current_am"),
  ]);

  const unique = <T extends Record<string, unknown>>(arr: T[], key: keyof T) =>
    Array.from(new Set(arr.map((r) => String(r[key])).filter(Boolean)));

  return {
    countries: unique(countries.data ?? [], "country"),
    buyerTypes: unique(buyerTypes.data ?? [], "buyer_type"),
    classifications: unique(classifications.data ?? [], "buyer_classification"),
    ams: unique(ams.data ?? [], "current_am"),
  };
}

// Admin — used only in API routes
export async function upsertLeads(rows: Partial<Lead>[]) {
  const { error } = await supabaseAdmin
    .from("leads")
    .upsert(rows, { onConflict: "organization,email" });
  if (error) throw new Error(error.message);
}

const REPLACE_CHUNK = 500;

/**
 * Replace ALL leads with `rows`, safely.
 *
 * Strategy ("id watermark"): remember the current max id, insert the new batch
 * (which gets higher ids), then delete everything at or below the watermark.
 * The table is never empty mid-operation, and if an insert fails we roll back
 * only the rows added this run — the previous data stays intact.
 *
 * Caller is responsible for the empty-file guard; this throws on 0 rows as a
 * last-resort safety net.
 */
export async function replaceAllLeads(
  rows: Record<string, unknown>[]
): Promise<{ inserted: number; removed: number }> {
  if (rows.length === 0) {
    throw new Error("Refusing to replace existing leads with 0 rows.");
  }

  const { data: maxRow, error: maxErr } = await supabaseAdmin
    .from("leads")
    .select("id")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (maxErr) throw new Error(`Reading watermark failed: ${maxErr.message}`);
  const watermark: number = (maxRow?.id as number) ?? 0;

  const stamp = new Date().toISOString();
  const toInsert = rows.map((r) => ({ ...r, imported_at: stamp }));

  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += REPLACE_CHUNK) {
    const chunk = toInsert.slice(i, i + REPLACE_CHUNK);
    const { error } = await supabaseAdmin.from("leads").insert(chunk);
    if (error) {
      // Roll back just this run's rows; old data (<= watermark) is untouched.
      await supabaseAdmin.from("leads").delete().gt("id", watermark);
      throw new Error(
        `Insert failed after ${inserted} rows (rolled back): ${error.message}`
      );
    }
    inserted += chunk.length;
  }

  const { count: removed, error: delErr } = await supabaseAdmin
    .from("leads")
    .delete({ count: "exact" })
    .lte("id", watermark);
  if (delErr) {
    throw new Error(
      `Inserted ${inserted} new rows but failed to remove the old ones: ${delErr.message}. Re-run to clear duplicates.`
    );
  }

  return { inserted, removed: removed ?? 0 };
}
