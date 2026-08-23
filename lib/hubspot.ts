/**
 * HubSpot client — READ-ONLY pull sync for the Customers segment.
 *
 * Scope (deliberately narrow, see supabase-migration-hubspot.sql):
 *  - Matches leads to existing HubSpot Contacts by exact email, and to
 *    existing HubSpot Companies by exact website domain. No fuzzy/name-only
 *    matching — a wrong match would silently attach the wrong company's
 *    deal/engagement data to a lead.
 *  - Pulls lightweight rollup fields only (deal stage, last activity date,
 *    notes count) — never the full call/email/meeting timeline, which isn't
 *    batchable and would mean ~1 API call per lead instead of ~1 per 100.
 *  - Never writes anything to HubSpot. qalara-lms is the reader here.
 */

const HUBSPOT_API_BASE = "https://api.hubapi.com";
const BATCH_SIZE = 100;

const CONTACT_PROPERTIES = ["email", "hs_last_sales_activity_timestamp", "notes_last_updated", "num_notes"];
const COMPANY_PROPERTIES = ["domain", "name", "hs_last_sales_activity_timestamp", "notes_last_updated", "num_notes"];
const DEAL_PROPERTIES = ["dealstage", "dealname", "closedate"];
const EMAIL_PROPERTIES = ["hs_email_subject", "hs_email_text", "hs_timestamp", "hs_email_direction"];
// Association order isn't guaranteed newest-first, so this is a bounded
// best-effort sample per contact, not a guaranteed "true latest" email.
const MAX_EMAILS_PER_CONTACT = 5;

export function hubspotConfigured(): boolean {
  return !!process.env.HUBSPOT_PRIVATE_APP_TOKEN;
}

async function hubspotFetch(path: string, body: unknown): Promise<any> {
  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  if (!token) throw new Error("HUBSPOT_PRIVATE_APP_TOKEN is not configured");
  const res = await fetch(`${HUBSPOT_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HubSpot API ${path} failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return res.json();
}

export function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** "https://www.Example.com/path" -> "example.com". Null when unparseable. */
export function extractDomain(website: string | null | undefined): string | null {
  const v = (website ?? "").trim();
  if (!v) return null;
  const withProtocol = /^[a-z]+:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const host = new URL(withProtocol).hostname.toLowerCase();
    return host.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

/** A lead's `email` column can hold several addresses (";"/","/"/"-separated).
 * HubSpot matching needs exactly one, so take the first that looks like an email. */
export function primaryEmailForMatch(email: string | null | undefined): string | null {
  const first = (email ?? "")
    .split(/[;,/]|\s+/)
    .map((e) => e.trim())
    .find((e) => e.includes("@"));
  return first ? first.toLowerCase() : null;
}

export type HubspotMatchStatus = "matched" | "not_found" | "skipped";

/** Pure classification, kept separate from the fetch calls so it's unit-testable
 * without mocking HubSpot's API. "matched" requires an exact contact or company
 * hit; "skipped" means the lead had neither an email nor a website to match on. */
export function classifyMatchStatus(input: {
  hasEmail: boolean;
  hasDomain: boolean;
  contactMatched: boolean;
  companyMatched: boolean;
}): HubspotMatchStatus {
  const { hasEmail, hasDomain, contactMatched, companyMatched } = input;
  if (!hasEmail && !hasDomain) return "skipped";
  if (contactMatched || companyMatched) return "matched";
  return "not_found";
}

export interface HubspotRecord {
  id: string;
  properties: Record<string, string | null>;
}

/** Batch-read HubSpot Contacts by exact email (idProperty=email). Emails with
 * no matching Contact are simply absent from the result — HubSpot's batch/read
 * doesn't error on a miss, it omits it. */
export async function batchReadContactsByEmail(emails: string[]): Promise<Map<string, HubspotRecord>> {
  const out = new Map<string, HubspotRecord>();
  const unique = Array.from(new Set(emails.filter(Boolean)));
  for (const batch of chunkArray(unique, BATCH_SIZE)) {
    const data = await hubspotFetch("/crm/v3/objects/contacts/batch/read", {
      idProperty: "email",
      properties: CONTACT_PROPERTIES,
      inputs: batch.map((id) => ({ id })),
    });
    for (const r of data.results ?? []) {
      const email = String(r.properties?.email ?? "").toLowerCase();
      if (email) out.set(email, r);
    }
  }
  return out;
}

/** Batch-read HubSpot Companies by exact website domain (idProperty=domain). */
export async function batchReadCompaniesByDomain(domains: string[]): Promise<Map<string, HubspotRecord>> {
  const out = new Map<string, HubspotRecord>();
  const unique = Array.from(new Set(domains.filter(Boolean)));
  for (const batch of chunkArray(unique, BATCH_SIZE)) {
    const data = await hubspotFetch("/crm/v3/objects/companies/batch/read", {
      idProperty: "domain",
      properties: COMPANY_PROPERTIES,
      inputs: batch.map((id) => ({ id })),
    });
    for (const r of data.results ?? []) {
      const domain = String(r.properties?.domain ?? "").toLowerCase();
      if (domain) out.set(domain, r);
    }
  }
  return out;
}

/**
 * A matched Contact's own primary Company, via the Contact→Company
 * association (batched) then a batched Company read — the reliable path.
 * Domain matching (above) turned out to miss most real companies in
 * practice: HubSpot doesn't require the `domain` property to be populated,
 * so many companies that ARE linked to the contact simply have no domain to
 * match on. This is the primary company lookup; domain matching stays as a
 * fallback for leads whose contact wasn't matched at all.
 */
export async function batchReadPrimaryCompanyForContacts(
  contactIds: string[]
): Promise<Map<string, HubspotRecord>> {
  const out = new Map<string, HubspotRecord>();
  const unique = Array.from(new Set(contactIds.filter(Boolean)));
  if (unique.length === 0) return out;

  const contactToCompanyId = new Map<string, string>();
  for (const batch of chunkArray(unique, BATCH_SIZE)) {
    const data = await hubspotFetch("/crm/v4/associations/contacts/companies/batch/read", {
      inputs: batch.map((id) => ({ id })),
    });
    for (const r of data.results ?? []) {
      const fromId = r.from?.id;
      const firstCompanyId = r.to?.[0]?.toObjectId;
      if (fromId && firstCompanyId) contactToCompanyId.set(String(fromId), String(firstCompanyId));
    }
  }

  const companyIds = Array.from(new Set(contactToCompanyId.values()));
  const companyById = new Map<string, HubspotRecord>();
  for (const batch of chunkArray(companyIds, BATCH_SIZE)) {
    const data = await hubspotFetch("/crm/v3/objects/companies/batch/read", {
      properties: COMPANY_PROPERTIES,
      inputs: batch.map((id) => ({ id })),
    });
    for (const r of data.results ?? []) companyById.set(String(r.id), r);
  }

  for (const [contactId, companyId] of Array.from(contactToCompanyId.entries())) {
    const company = companyById.get(companyId);
    if (company) out.set(contactId, company);
  }
  return out;
}

/**
 * Deal stage per contact, via the Contact→Deal association (batched) then a
 * batched Deal read. Best-effort: this is a bonus rollup, not required for a
 * "matched" status, so a missing associations scope on the Private App
 * shouldn't fail the whole sync — callers should catch and continue.
 */
export async function batchReadPrimaryDealStage(
  contactIds: string[]
): Promise<Map<string, { stage: string | null; dealName: string | null }>> {
  const out = new Map<string, { stage: string | null; dealName: string | null }>();
  const unique = Array.from(new Set(contactIds.filter(Boolean)));
  if (unique.length === 0) return out;

  const contactToDealId = new Map<string, string>();
  for (const batch of chunkArray(unique, BATCH_SIZE)) {
    const data = await hubspotFetch("/crm/v4/associations/contacts/deals/batch/read", {
      inputs: batch.map((id) => ({ id })),
    });
    for (const r of data.results ?? []) {
      const fromId = r.from?.id;
      const firstDealId = r.to?.[0]?.toObjectId;
      if (fromId && firstDealId) contactToDealId.set(String(fromId), String(firstDealId));
    }
  }

  const dealIds = Array.from(new Set(contactToDealId.values()));
  const dealById = new Map<string, HubspotRecord>();
  for (const batch of chunkArray(dealIds, BATCH_SIZE)) {
    const data = await hubspotFetch("/crm/v3/objects/deals/batch/read", {
      properties: DEAL_PROPERTIES,
      inputs: batch.map((id) => ({ id })),
    });
    for (const r of data.results ?? []) dealById.set(String(r.id), r);
  }

  for (const [contactId, dealId] of Array.from(contactToDealId.entries())) {
    const deal = dealById.get(dealId);
    out.set(contactId, {
      stage: deal?.properties?.dealstage ?? null,
      dealName: deal?.properties?.dealname ?? null,
    });
  }
  return out;
}

export interface HubspotLatestEmail {
  subject: string | null;
  text: string | null;
  timestamp: string | null;
  direction: string | null;
}

/**
 * Full body of the most recent logged Email engagement per contact (subject +
 * text + timestamp). Unlike the rollup fields, this is NOT batchable the same
 * way — each contact needs its own association lookup, so it's meaningfully
 * slower and heavier than the rest of the pull. Only call this for contacts
 * that were actually matched; treat failures as best-effort (see caller).
 */
export async function batchReadLatestEmailPerContact(
  contactIds: string[]
): Promise<Map<string, HubspotLatestEmail>> {
  const out = new Map<string, HubspotLatestEmail>();
  const unique = Array.from(new Set(contactIds.filter(Boolean)));
  if (unique.length === 0) return out;

  const contactToEmailIds = new Map<string, string[]>();
  for (const batch of chunkArray(unique, BATCH_SIZE)) {
    const data = await hubspotFetch("/crm/v4/associations/contacts/emails/batch/read", {
      inputs: batch.map((id) => ({ id })),
    });
    for (const r of data.results ?? []) {
      const fromId = r.from?.id;
      if (!fromId) continue;
      const ids = (r.to ?? [])
        .slice(0, MAX_EMAILS_PER_CONTACT)
        .map((t: { toObjectId: string | number }) => String(t.toObjectId));
      if (ids.length > 0) contactToEmailIds.set(String(fromId), ids);
    }
  }

  const allEmailIds = Array.from(new Set(Array.from(contactToEmailIds.values()).flat()));
  const emailById = new Map<string, HubspotRecord>();
  for (const batch of chunkArray(allEmailIds, BATCH_SIZE)) {
    const data = await hubspotFetch("/crm/v3/objects/emails/batch/read", {
      properties: EMAIL_PROPERTIES,
      inputs: batch.map((id) => ({ id })),
    });
    for (const r of data.results ?? []) emailById.set(String(r.id), r);
  }

  for (const [contactId, emailIds] of Array.from(contactToEmailIds.entries())) {
    let latest: HubspotRecord | null = null;
    let latestTs = -Infinity;
    for (const eid of emailIds) {
      const rec = emailById.get(eid);
      if (!rec) continue;
      const ts = Date.parse(String(rec.properties?.hs_timestamp ?? "")) || 0;
      if (ts > latestTs) {
        latestTs = ts;
        latest = rec;
      }
    }
    if (latest) {
      out.set(contactId, {
        subject: latest.properties?.hs_email_subject ?? null,
        text: latest.properties?.hs_email_text ?? null,
        timestamp: latest.properties?.hs_timestamp ?? null,
        direction: latest.properties?.hs_email_direction ?? null,
      });
    }
  }
  return out;
}

export interface HubspotSyncInput {
  id: number;
  email: string | null;
  website: string | null;
}

export interface HubspotSyncResult {
  id: number;
  hubspot_contact_id: string | null;
  hubspot_company_id: string | null;
  hubspot_deal_stage: string | null;
  hubspot_last_activity_date: string | null;
  hubspot_notes_count: number | null;
  hubspot_match_status: HubspotMatchStatus;
  /** Maps onto the EXISTING last_email_subject / email_contact_summary
   * columns (overwriting the sheet's version) — null when no HubSpot email
   * was found, in which case the caller should leave those fields untouched
   * rather than blanking them. */
  email_subject: string | null;
  email_summary: string | null;
}

/** Orchestrates the whole read-only pull for a batch of leads: match Contacts
 * by email, Companies by domain, then attach a best-effort deal stage. */
export async function pullHubspotDataForLeads(leads: HubspotSyncInput[]): Promise<HubspotSyncResult[]> {
  const emailByLead = new Map<number, string | null>();
  const domainByLead = new Map<number, string | null>();
  const allEmails: string[] = [];
  const allDomains: string[] = [];

  for (const lead of leads) {
    const email = primaryEmailForMatch(lead.email);
    const domain = extractDomain(lead.website);
    emailByLead.set(lead.id, email);
    domainByLead.set(lead.id, domain);
    if (email) allEmails.push(email);
    if (domain) allDomains.push(domain);
  }

  const [contactsByEmail, companiesByDomain] = await Promise.all([
    batchReadContactsByEmail(allEmails),
    batchReadCompaniesByDomain(allDomains),
  ]);

  // These three are fully independent of each other (each only needs
  // matchedContactIds), so run them concurrently rather than one after
  // another — this is what keeps the whole sync inside Vercel's function
  // timeout. Promise.allSettled so one failing (e.g. a missing scope) can't
  // block the other two, matching the existing best-effort philosophy.
  const matchedContactIds = Array.from(contactsByEmail.values()).map((c) => c.id);
  const [dealStageSettled, emailSettled, companySettled] = await Promise.allSettled([
    batchReadPrimaryDealStage(matchedContactIds),
    batchReadLatestEmailPerContact(matchedContactIds),
    // The Contact→Company association is the reliable path (see doc comment
    // on batchReadPrimaryCompanyForContacts) — domain matching above is a
    // fallback only for leads whose contact wasn't matched at all.
    batchReadPrimaryCompanyForContacts(matchedContactIds),
  ]);

  function orEmptyMap<T>(
    settled: PromiseSettledResult<Map<string, T>>,
    logMessage: string
  ): Map<string, T> {
    if (settled.status === "fulfilled") return settled.value;
    console.error(logMessage, settled.reason);
    return new Map<string, T>();
  }

  const dealStageByContact = orEmptyMap(
    dealStageSettled,
    "HubSpot deal-stage lookup failed (continuing without it):"
  );
  const emailByContact = orEmptyMap(emailSettled, "HubSpot email pull failed (continuing without it):");
  const companyByContact = orEmptyMap(
    companySettled,
    "HubSpot company-association lookup failed (falling back to domain matching only):"
  );

  return leads.map((lead) => {
    const email = emailByLead.get(lead.id) ?? null;
    const domain = domainByLead.get(lead.id) ?? null;
    const contact = email ? contactsByEmail.get(email) : undefined;
    const company =
      (contact && companyByContact.get(contact.id)) ?? (domain ? companiesByDomain.get(domain) : undefined);
    const deal = contact ? dealStageByContact.get(contact.id) : undefined;
    const latestEmail = contact ? emailByContact.get(contact.id) : undefined;

    const lastActivity =
      contact?.properties?.hs_last_sales_activity_timestamp ??
      company?.properties?.hs_last_sales_activity_timestamp ??
      null;
    const notesCountRaw = contact?.properties?.num_notes ?? company?.properties?.num_notes ?? null;
    const emailDateLabel = latestEmail?.timestamp
      ? new Date(latestEmail.timestamp).toISOString().slice(0, 10)
      : null;
    const emailSummary = latestEmail?.text
      ? emailDateLabel
        ? `${emailDateLabel} — ${latestEmail.text}`
        : latestEmail.text
      : null;

    return {
      id: lead.id,
      hubspot_contact_id: contact?.id ?? null,
      hubspot_company_id: company?.id ?? null,
      hubspot_deal_stage: deal?.stage ?? null,
      hubspot_last_activity_date: lastActivity,
      hubspot_notes_count: notesCountRaw != null ? Number(notesCountRaw) : null,
      email_subject: latestEmail?.subject ?? null,
      email_summary: emailSummary,
      hubspot_match_status: classifyMatchStatus({
        hasEmail: !!email,
        hasDomain: !!domain,
        contactMatched: !!contact,
        companyMatched: !!company,
      }),
    };
  });
}
