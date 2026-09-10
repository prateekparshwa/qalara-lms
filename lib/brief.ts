/**
 * AM Daily Brief — server-side queries.
 *
 * The brief answers one question for the logged-in AM: "which leads were
 * (re)assigned to me since I last looked?" Data comes from the am_assignments
 * audit log (written by the assign-am endpoints); identity comes from the
 * am_directory table (Qalara login email -> canonical AM name).
 *
 * Identity today is the self-entered email in localStorage (same soft model as
 * the AM-edit gate). When Google SSO lands, only the email source changes.
 */
import { supabaseAdmin } from "./supabase";
import { sanitizeAmValue } from "./format";

/** How far back the brief looks when the AM has never opened it. */
const FIRST_LOOK_WINDOW_DAYS = 7;
const MAX_ENTRIES = 100;

export interface BriefLead {
  id: number | null;
  organization: string | null;
  segment: string | null;
  country: string | null;
  buyer_classification: string | null;
  current_am: string | null;
  notes: string | null;
}

export interface BriefEntry {
  assignedAt: string;
  assignedBy: string | null;
  fromAm: string | null;
  toAm: string;
  lead: BriefLead | null;
}

export interface BriefResult {
  /** Canonical AM name resolved from the email, or null if not in the directory. */
  amName: string | null;
  /** True when the email maps to an active am_directory row. */
  configured: boolean;
  lastSeenAt: string | null;
  /** Assignments to this AM since lastSeenAt (or the first-look window). */
  count: number;
  entries: BriefEntry[];
}

function canon(v: string | null | undefined): string {
  return (sanitizeAmValue(v) ?? "").trim().toLowerCase();
}

/** True when the error is "table doesn't exist yet" — i.e. the migration
 * hasn't been run. Lets every brief path no-op silently until it has. */
function isMissingTable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return (
    err.code === "42P01" || // Postgres: undefined_table
    err.code === "PGRST205" || // PostgREST: relation not found in schema cache
    /relation .* does not exist|Could not find the table/i.test(err.message ?? "")
  );
}

/** Resolve a login email to the AM's canonical name via am_directory. */
export async function resolveAmName(email: string | null | undefined): Promise<string | null> {
  const e = (email ?? "").trim().toLowerCase();
  if (!e) return null;
  const { data, error } = await supabaseAdmin
    .from("am_directory")
    .select("am_name, active")
    .eq("email", e)
    .maybeSingle();
  if (error) {
    if (!isMissingTable(error)) console.error("resolveAmName:", error.message);
    return null;
  }
  if (!data || data.active === false) return null;
  return (data.am_name as string) ?? null;
}

/** Build the brief for the AM behind this email. */
export async function getBrief(email: string | null | undefined): Promise<BriefResult> {
  const amName = await resolveAmName(email);
  if (!amName) {
    return { amName: null, configured: false, lastSeenAt: null, count: 0, entries: [] };
  }

  // Last-seen marker (per canonical AM name).
  const { data: stateRow } = await supabaseAdmin
    .from("am_brief_state")
    .select("last_seen_at")
    .eq("am_name", amName)
    .maybeSingle();
  const lastSeenAt: string | null = stateRow?.last_seen_at ?? null;
  const since = lastSeenAt
    ? new Date(lastSeenAt)
    : new Date(Date.now() - FIRST_LOOK_WINDOW_DAYS * 86400_000);

  // Pull recent assignments and match on the canonicalised AM name, so a lead
  // assigned as "Gouri" still counts for "Gouri Sree".
  const target = canon(amName);
  const { data: rows, error } = await supabaseAdmin
    .from("am_assignments")
    .select("lead_id, lead_org, lead_email, segment, from_am, to_am, assigned_by, assigned_at")
    .gte("assigned_at", since.toISOString())
    .order("assigned_at", { ascending: false })
    .limit(500);
  if (error) {
    if (isMissingTable(error)) {
      return { amName, configured: true, lastSeenAt, count: 0, entries: [] };
    }
    throw new Error(`Reading assignments failed: ${error.message}`);
  }

  const mine = (rows ?? []).filter((r) => canon(r.to_am as string) === target).slice(0, MAX_ENTRIES);

  // Re-resolve each lead to its CURRENT row (ids change on a full sheet sync),
  // matching by organization within the segment. One query for all of them.
  const orgs = Array.from(new Set(mine.map((r) => (r.lead_org ?? "").trim()).filter(Boolean)));
  const leadByKey = new Map<string, BriefLead>();
  if (orgs.length > 0) {
    const { data: leads } = await supabaseAdmin
      .from("leads")
      .select("id, organization, segment, country, buyer_classification, current_am, notes")
      .in("organization", orgs);
    for (const l of leads ?? []) {
      leadByKey.set(`${(l.organization ?? "").trim().toLowerCase()}|${l.segment ?? ""}`, l as BriefLead);
    }
  }

  const entries: BriefEntry[] = mine.map((r) => ({
    assignedAt: r.assigned_at as string,
    assignedBy: (r.assigned_by as string) ?? null,
    fromAm: (r.from_am as string) ?? null,
    toAm: r.to_am as string,
    lead:
      leadByKey.get(`${(r.lead_org ?? "").trim().toLowerCase()}|${r.segment ?? ""}`) ?? null,
  }));

  return {
    amName,
    configured: true,
    lastSeenAt,
    count: entries.length,
    entries,
  };
}

/** Stamp "the AM has now seen their brief" so the unread count resets. */
export async function markBriefSeen(email: string | null | undefined): Promise<string | null> {
  const amName = await resolveAmName(email);
  if (!amName) return null;
  const { error } = await supabaseAdmin
    .from("am_brief_state")
    .upsert({ am_name: amName, last_seen_at: new Date().toISOString() }, { onConflict: "am_name" });
  if (error && !isMissingTable(error)) {
    throw new Error(`Updating brief state failed: ${error.message}`);
  }
  return amName;
}

/**
 * Append audit rows for an assignment. Best-effort: callers should not fail the
 * assignment if this throws. Skips no-op rows (same AM before and after).
 */
export async function logAssignments(
  entries: {
    lead_id: number | null;
    lead_org: string | null;
    lead_email: string | null;
    segment: string | null;
    from_am: string | null;
    to_am: string;
    assigned_by: string | null;
  }[]
): Promise<void> {
  const rows = entries.filter((e) => canon(e.from_am) !== canon(e.to_am));
  if (rows.length === 0) return;
  const { error } = await supabaseAdmin.from("am_assignments").insert(
    rows.map((e) => ({ ...e, assigned_at: new Date().toISOString() }))
  );
  if (error && !isMissingTable(error)) {
    throw new Error(`Logging assignments failed: ${error.message}`);
  }
}
