import { supabaseAdmin } from "./supabase";
import { classificationTier } from "./format";

// All query helpers run server-side (in API routes only), so we use the
// admin client. RLS stays enabled, blocking any direct anon/browser access.
const supabase = supabaseAdmin;

/**
 * Strip everything but letters/digits and lowercase, matching the
 * `organization_normalized` generated column (see
 * supabase-migration-org-search.sql). Lets a search for "Asterblume" find a
 * lead stored as "Aster Blume Living" — spacing, punctuation and case all
 * stop mattering once both sides are normalized the same way.
 */
export function normalizeOrgTerm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

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
  /** True when the AM was set in the dashboard — Sync must not overwrite it
   * from the sheet until it's released back to the sheet in the dashboard. */
  am_locked: boolean | null;
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
  /** Customers-segment only: "Active" or "Churned", from the sheet's own
   * "Segment" column (a customer-lifecycle status — not the app's `segment`). */
  customer_status: string | null;
  /** Free-text AM notes (dashboard-only; never in the sheet, preserved on sync). */
  notes: string | null;
  notes_updated_at: string | null;
  notes_updated_by: string | null;
  /** Customers-segment only: read-only rollup fields pulled from HubSpot
   * (see lib/hubspot.ts). Never written back to HubSpot. */
  hubspot_contact_id: string | null;
  hubspot_company_id: string | null;
  hubspot_deal_stage: string | null;
  hubspot_last_activity_date: string | null;
  hubspot_notes_count: number | null;
  hubspot_match_status: string | null;
  hubspot_synced_at: string | null;
  /** True once a HubSpot pull has written last_email_subject /
   * email_contact_summary — a later Sheets sync then leaves them alone,
   * mirroring am_locked for current_am (see replaceSegmentLeads). */
  hubspot_email_locked: boolean | null;
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
  /** "yes" → only leads with no Account Manager (blank or "No Active AM"). */
  unassigned?: string;
  confidence?: string;
  org_scale?: string;
  /** "yes" → only buyers whose Sources-From-India field is a confirmed Yes. */
  india?: string;
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
    unassigned,
    confidence,
    org_scale,
    india,
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

  // Free-text search across org, email, website (legacy single-field).
  // Organization goes through the same normalized match as the dedicated
  // org filter below, for the same reason (spacing/punctuation shouldn't
  // hide a real lead).
  if (q && q.trim()) {
    const term = q.trim();
    query = query.or(
      `organization_normalized.ilike.%${normalizeOrgTerm(term)}%,email.ilike.%${term}%,website.ilike.%${term}%,full_name.ilike.%${term}%`
    );
  }

  // Dedicated per-field search (combined with AND). Organization matches as
  // a normalized substring — "Asterblume" finds "Aster Blume Living" since
  // both sides are lowercased and stripped of spaces/punctuation before
  // comparing (see organization_normalized in supabase-migration-org-search.sql).
  // Deliberately broader than a prefix match: showing "Trendarredo" for a
  // search of "arredo" beats hiding a real lead over a spacing difference.
  if (org && org.trim())
    query = query.ilike("organization_normalized", `%${normalizeOrgTerm(org)}%`);
  if (email && email.trim())
    query = query.ilike("email", `%${email.trim()}%`);
  if (website && website.trim())
    query = query.ilike("website", `%${website.trim()}%`);

  if (country) query = query.eq("country", country);
  if (buyer_type) query = query.ilike("buyer_type", `%${buyer_type}%`);
  // Tier is the leading word; prefix-match so "HIGH" doesn't catch "higher".
  if (classification) query = query.ilike("buyer_classification", `${classification}%`);
  // "Unassigned" = no AM at all: blank, NULL, or the "No Active AM" placeholder
  // (mirrors how getLeadStats counts assigned leads). Takes precedence over a
  // specific AM filter, which the UI clears when this is on.
  if (unassigned === "yes") {
    query = query.or(
      'current_am.is.null,current_am.eq.,current_am.eq."No Active AM"'
    );
  } else if (am) {
    query = query.ilike("current_am", `%${am}%`);
  }
  if (confidence) query = query.ilike("website_confidence", `%${confidence}%`);
  if (org_scale) query = query.eq("org_scale", org_scale);
  // Sources-From-India is free text, but confirmed entries always start "Yes".
  if (india === "yes") query = query.ilike("imports_from_india", "yes%");

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

/**
 * Typeahead suggestions for the search box — matches the term against BOTH the
 * organization name and any email ID at once, so a user can find a buyer
 * whether they type a brand name or an email fragment. Returns full rows (cheap
 * at limit 8) so the caller can open the profile drawer directly on click.
 */
export async function suggestLeads(
  q: string,
  segment?: string,
  limit = 8
): Promise<Lead[]> {
  // Strip characters that would break PostgREST's .or()/ilike filter grammar.
  const term = q.replace(/[%,()]/g, " ").trim();
  if (term.length < 2) return [];

  let query = supabase.from("leads").select("*");
  if (segment) query = query.eq("segment", segment);
  query = query
    .or(
      `organization_normalized.ilike.%${normalizeOrgTerm(term)}%,email.ilike.%${term}%`
    )
    .order("organization", { ascending: true })
    .limit(limit);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as Lead[]) ?? [];
}

export interface DirectorySearchParams {
  org?: string;
  website?: string;
  email?: string;
  buyerName?: string;
  country?: string;
}

/**
 * Cross-segment buyer lookup for the Directory chooser: the user knows a few
 * details about a buyer but not which segment they're in. Combines whichever
 * fields are filled with AND (same per-field match style as getLeads), scoped
 * to the given (active) segments only — never touches 'discover'.
 */
export async function searchDirectory(
  params: DirectorySearchParams,
  segments: string[],
  limit = 30
): Promise<{ data: Lead[]; total: number }> {
  const { org, website, email, buyerName, country } = params;
  if (!org?.trim() && !website?.trim() && !email?.trim() && !buyerName?.trim() && !country?.trim()) {
    return { data: [], total: 0 };
  }
  if (segments.length === 0) return { data: [], total: 0 };

  let query = supabase
    .from("leads")
    .select("*", { count: "exact" })
    .in("segment", segments);

  // Normalized substring match — see normalizeOrgTerm() above. A search for
  // "Asterblume" must find "Aster Blume Living"; hiding a real lead over a
  // spacing/punctuation difference is worse than a few extra results.
  if (org?.trim())
    query = query.ilike("organization_normalized", `%${normalizeOrgTerm(org)}%`);
  if (website?.trim()) query = query.ilike("website", `%${website.trim()}%`);
  if (email?.trim()) query = query.ilike("email", `%${email.trim()}%`);
  if (buyerName?.trim()) query = query.ilike("full_name", `%${buyerName.trim()}%`);
  if (country?.trim()) query = query.ilike("country", `%${country.trim()}%`);

  query = query.order("organization", { ascending: true }).limit(limit);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  return { data: (data as Lead[]) ?? [], total: count ?? 0 };
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

  // Tier is the LEADING word, so prefix-match — a substring "%HIGH%" wrongly
  // counts "higher"/"high" inside LOW/MED rationale sentences.
  const { count: highConf } = await countQuery().ilike(
    "website_confidence",
    "HIGH%"
  );

  const { count: highClass } = await countQuery().ilike(
    "buyer_classification",
    "HIGH%"
  );

  const { count: amAssigned } = await countQuery()
    .not("current_am", "is", null)
    .neq("current_am", "")
    .neq("current_am", "No Active AM");

  return {
    total: total ?? 0,
    verified: verified ?? 0,
    highConfidence: highConf ?? 0,
    highClassification: highClass ?? 0,
    amAssigned: amAssigned ?? 0,
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
  // Supabase/PostgREST caps each response at ~1000 rows regardless of .limit(),
  // and an .order() would bias that window alphabetically — so distinct values
  // for AMs/countries past the cut-off (e.g. "Srijaa", "Shivani") never surface.
  // Instead, page through EVERY row in 1000-row chunks and collect distinct
  // values for all four filters in a single pass.
  const PAGE = 1000;
  const SELECT = "country,buyer_type,buyer_classification,current_am,org_scale";

  const countries = new Set<string>();
  const buyerTypes = new Set<string>();
  const classifications = new Set<string>();
  const ams = new Set<string>();
  const orgScales = new Set<string>();

  const add = (set: Set<string>, v: unknown) => {
    const s = (v == null ? "" : String(v)).trim();
    if (s && s.toLowerCase() !== "null") set.add(s);
  };

  for (let from = 0; ; from += PAGE) {
    let q = supabase
      .from("leads")
      .select(SELECT)
      .range(from, from + PAGE - 1);
    if (segment) q = q.eq("segment", segment);

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    const rows = (data as Record<string, unknown>[] | null) ?? [];
    for (const r of rows) {
      add(countries, r.country);
      add(buyerTypes, r.buyer_type);
      // Collapse the AI rationale sentence to its tier so the filter shows
      // HIGH/MEDIUM/LOW, not thousands of unique sentences.
      add(classifications, classificationTier(r.buyer_classification as string));
      add(ams, r.current_am);
      add(orgScales, r.org_scale);
    }

    // A short page means we've reached the end of the table.
    if (rows.length < PAGE) break;
  }

  const sorted = (s: Set<string>) =>
    Array.from(s).sort((a, b) => a.localeCompare(b));

  // Classifications display in priority order, not alphabetical.
  const TIER_ORDER = ["HIGH", "MEDIUM", "LOW"];
  const classificationOrder = Array.from(classifications).sort(
    (a, b) => TIER_ORDER.indexOf(a) - TIER_ORDER.indexOf(b)
  );

  return {
    countries: sorted(countries),
    buyerTypes: sorted(buyerTypes),
    classifications: classificationOrder,
    ams: sorted(ams),
    orgScales: sorted(orgScales),
  };
}

// Admin — used only in API routes
export async function upsertLeads(rows: Partial<Lead>[]) {
  const { error } = await supabaseAdmin
    .from("leads")
    .upsert(rows, { onConflict: "organization,email" });
  if (error) throw new Error(error.message);
}

/** Numeric priority for sorting (HIGH > MED > LOW > unset). Anchored to the
 * leading tier word so rationale text ("…lift it higher") can't inflate it. */
export function priorityRank(classification: unknown): number {
  const tier = classificationTier(
    typeof classification === "string" ? classification : String(classification ?? "")
  );
  return tier === "HIGH" ? 3 : tier === "MEDIUM" ? 2 : tier === "LOW" ? 1 : 0;
}

const REPLACE_CHUNK = 500;

/**
 * Columns carried over from the existing DB rows when the sheet no longer
 * provides them, so dropping a column from the sheet doesn't wipe its data on
 * the next sync. Only applies when the column is ENTIRELY absent from the
 * incoming rows (a blank cell in a present column is still respected).
 */
const PRESERVE_COLUMNS = [
  "website_confidence",
  "full_name_original",
  // Dashboard-only AM notes — never present in the sheet, so always carried
  // over (the absent-column rule preserves them on every sync).
  "notes",
  "notes_updated_at",
  "notes_updated_by",
] as const;

/** Stable identity for matching an old DB row to a new sheet row: normalized
 * website first (the most reliable key), else organization + first email. */
function identityKey(r: Record<string, unknown>): string {
  const web = String(r.website ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
  if (web && web !== "null") return `w:${web}`;
  const org = String(r.organization ?? "").trim().toLowerCase();
  const email = String(r.email ?? "")
    .trim()
    .toLowerCase()
    .split(/[;,\s/]+/)[0];
  if (!org && !email) return "";
  return `o:${org}|${email}`;
}

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

  // Carry-over: pull last-known values from existing rows (matched by identity)
  // so a sync doesn't blank them. Two things are carried:
  //  1. PRESERVE_COLUMNS — only when the column is ENTIRELY absent from the
  //     sheet (a present-but-empty cell is respected and left as-is).
  //  2. current_am / am_locked — a dashboard-LOCKED AM always wins over the
  //     sheet, so a stale Excel value (e.g. "Srijaa") can't revert a UI
  //     reassignment (e.g. "Gouri"). The lock is only cleared by an explicit
  //     "release to sheet" action in the dashboard. When the whole AM column is
  //     absent from the sheet, every row's AM (and lock) is preserved.
  const absentPreserve = PRESERVE_COLUMNS.filter(
    (col) => !rows.some((r) => col in r)
  );
  const amColumnAbsent = !rows.some((r) => "current_am" in r);
  const hasVal = (v: unknown) => v != null && String(v).trim() !== "";

  // Always read prior rows (we need AM-lock state every sync).
  const carry = new Map<string, Record<string, unknown>>();
  if (watermark > 0) {
    const cols = Array.from(
      new Set([
        "organization",
        "website",
        "email",
        "current_am",
        "am_locked",
        "last_email_subject",
        "email_contact_summary",
        "hubspot_email_locked",
        ...absentPreserve,
      ])
    ).join(",");
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabaseAdmin
        .from("leads")
        .select(cols)
        .eq("segment", segment)
        .lte("id", watermark)
        .range(from, from + pageSize - 1);
      if (error) throw new Error(`Reading prior values failed: ${error.message}`);
      if (!data || data.length === 0) break;
      for (const row of data as unknown as Record<string, unknown>[]) {
        const k = identityKey(row);
        if (k) carry.set(k, row);
      }
      if (data.length < pageSize) break;
    }
  }

  const stamp = new Date().toISOString();
  const toInsert = rows.map((r) => {
    const base: Record<string, unknown> = {
      ...r,
      segment,
      imported_at: stamp,
      priority_rank: priorityRank(r.buyer_classification),
    };
    const prior = carry.get(identityKey(r));

    // --- AM lock handling ---
    if (amColumnAbsent) {
      // Sheet doesn't carry AM at all — keep whatever the DB had, lock and all.
      if (prior) {
        if (hasVal(prior.current_am)) base.current_am = prior.current_am;
        base.am_locked = prior.am_locked === true;
      } else {
        base.am_locked = false;
      }
    } else if (prior && prior.am_locked === true && hasVal(prior.current_am)) {
      // Dashboard-locked AM wins over the sheet value.
      base.current_am = prior.current_am;
      base.am_locked = true;
    } else {
      // Sheet value wins (already spread from r); mark unlocked.
      base.am_locked = false;
    }

    // --- HubSpot email lock handling (same pattern as AM above) ---
    if (prior && prior.hubspot_email_locked === true) {
      base.last_email_subject = prior.last_email_subject;
      base.email_contact_summary = prior.email_contact_summary;
      base.hubspot_email_locked = true;
    } else {
      base.hubspot_email_locked = false;
    }

    // --- PRESERVE_COLUMNS blank-fill (only when the column is absent) ---
    if (absentPreserve.length > 0 && prior) {
      for (const col of absentPreserve) {
        if (base[col] == null && prior[col] != null) base[col] = prior[col];
      }
    }

    return base;
  });

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
