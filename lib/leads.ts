import { supabaseAdmin } from "./supabase";

// All query helpers run server-side (in API routes only), so we use the
// admin client. RLS stays enabled, blocking any direct anon/browser access.
const supabase = supabaseAdmin;

export interface Lead {
  id: number;
  segment: string | null;
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
  segment?: string;
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
    segment,
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

  // Scope to a single segment (engagement / no_engagement / prospects / discover)
  if (segment) query = query.eq("segment", segment);

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

  // Priority is text (HIGH/MED/LOW), so sort by the numeric rank instead.
  const sortCol = sort === "buyer_classification" ? "priority_rank" : sort;
  query = query.order(sortCol, { ascending: order === "asc", nullsFirst: false });
  if (sortCol === "priority_rank") {
    query = query.order("organization", { ascending: true }); // stable tiebreak
  }
  query = query.range(from, to);

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

export async function getLeadStats(segment?: string) {
  // Helper: a fresh head-count query, scoped to the segment when provided.
  const countQuery = () => {
    let q = supabase.from("leads").select("*", { count: "exact", head: true });
    if (segment) q = q.eq("segment", segment);
    return q;
  };

  const { count: total } = await countQuery();

  const { count: verified } = await countQuery()
    .not("website", "is", null)
    .neq("website", "");

  const { count: highConf } = await countQuery().ilike(
    "website_confidence",
    "%HIGH%"
  );

  const { count: highClass } = await countQuery().ilike(
    "buyer_classification",
    "%HIGH%"
  );

  return {
    total: total ?? 0,
    verified: verified ?? 0,
    highConfidence: highConf ?? 0,
    highClassification: highClass ?? 0,
  };
}

/** Most recent imported_at across the table (or one segment) — for the lobby "last synced" signal. */
export async function getLastSynced(segment?: string): Promise<string | null> {
  let q = supabase
    .from("leads")
    .select("imported_at")
    .not("imported_at", "is", null)
    .order("imported_at", { ascending: false })
    .limit(1);
  if (segment) q = q.eq("segment", segment);
  const { data } = await q.maybeSingle();
  return (data?.imported_at as string) ?? null;
}

export async function getFilterOptions(segment?: string) {
  const col = (name: string) => {
    let q = supabase
      .from("leads")
      .select(name)
      .not(name, "is", null)
      .neq(name, "")
      .order(name);
    if (segment) q = q.eq("segment", segment);
    return q;
  };

  const [countries, buyerTypes, classifications, ams] = await Promise.all([
    col("country"),
    col("buyer_type"),
    col("buyer_classification"),
    col("current_am"),
  ]);

  const unique = (
    arr: Record<string, unknown>[] | null,
    key: string
  ): string[] =>
    Array.from(
      new Set((arr ?? []).map((r) => String(r[key])).filter(Boolean))
    );

  const rows = (r: { data: unknown }) =>
    (r.data as Record<string, unknown>[] | null) ?? [];

  return {
    countries: unique(rows(countries), "country"),
    buyerTypes: unique(rows(buyerTypes), "buyer_type"),
    classifications: unique(rows(classifications), "buyer_classification"),
    ams: unique(rows(ams), "current_am"),
  };
}

// Admin — used only in API routes
export async function upsertLeads(rows: Partial<Lead>[]) {
  const { error } = await supabaseAdmin
    .from("leads")
    .upsert(rows, { onConflict: "organization,email" });
  if (error) throw new Error(error.message);
}

/** Numeric priority for sorting (HIGH > MED > LOW > unset). */
export function priorityRank(classification: unknown): number {
  const s = String(classification ?? "").toUpperCase();
  if (s.includes("HIGH")) return 3;
  if (s.includes("MED")) return 2;
  if (s.includes("LOW")) return 1;
  return 0;
}

const REPLACE_CHUNK = 500;

/**
 * Replace all rows of ONE segment with `rows`, safely.
 *
 * Strategy ("id watermark", scoped per segment): remember the current max id
 * within this segment, insert the new batch tagged with the segment (new rows
 * get higher ids), then delete this segment's rows at or below the watermark.
 * Other segments are never touched. The segment is never empty mid-operation,
 * and a failed insert rolls back only this run's rows.
 *
 * Caller is responsible for the empty-source guard; this throws on 0 rows as a
 * last-resort safety net.
 */
export async function replaceSegmentLeads(
  segment: string,
  rows: Record<string, unknown>[]
): Promise<{ inserted: number; removed: number }> {
  if (rows.length === 0) {
    throw new Error(
      `Refusing to replace segment "${segment}" with 0 rows.`
    );
  }

  const { data: maxRow, error: maxErr } = await supabaseAdmin
    .from("leads")
    .select("id")
    .eq("segment", segment)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (maxErr) throw new Error(`Reading watermark failed: ${maxErr.message}`);
  const watermark: number = (maxRow?.id as number) ?? 0;

  const stamp = new Date().toISOString();
  const toInsert = rows.map((r) => ({
    ...r,
    segment,
    imported_at: stamp,
    priority_rank: priorityRank(r.buyer_classification),
  }));

  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += REPLACE_CHUNK) {
    const chunk = toInsert.slice(i, i + REPLACE_CHUNK);
    const { error } = await supabaseAdmin.from("leads").insert(chunk);
    if (error) {
      // Roll back just this run's rows; older rows in this segment are untouched.
      await supabaseAdmin
        .from("leads")
        .delete()
        .eq("segment", segment)
        .gt("id", watermark);
      throw new Error(
        `Insert failed after ${inserted} rows (rolled back): ${error.message}`
      );
    }
    inserted += chunk.length;
  }

  const { count: removed, error: delErr } = await supabaseAdmin
    .from("leads")
    .delete({ count: "exact" })
    .eq("segment", segment)
    .lte("id", watermark);
  if (delErr) {
    throw new Error(
      `Inserted ${inserted} new rows but failed to remove the old ones: ${delErr.message}. Re-run to clear duplicates.`
    );
  }

  return { inserted, removed: removed ?? 0 };
}
