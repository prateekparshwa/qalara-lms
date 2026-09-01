/**
 * "Leads&Enqs Tracker" sync — a recurring, additive check against the
 * ByrMaster + EnquiryTracker tabs of the standalone tracker spreadsheet
 * (distinct from the Qualified Leads / Customers workbook the rest of the
 * app syncs from).
 *
 * Unlike a segment Sync (which REPLACES the whole segment with the sheet's
 * current contents — see replaceSegmentLeads), this is deliberately
 * additive-only: it finds tracker orgs with no existing DB record in
 * Customers or Engagement, and creates just those, via the same web-research
 * pipeline used by General Discovery. It never touches or deletes an
 * existing lead.
 *
 * Matching is intentionally conservative (squashed-exact + suffix-stripped
 * "soft" match) rather than the full fuzzy/Levenshtein audit built for the
 * one-time manual reconciliation earlier in this project — a false "already
 * exists" just means a real gap goes unnoticed until the next run, while a
 * false "new" would create a live duplicate. The dry-run preview is the
 * actual safety net: every "new" org is shown before anything is created.
 */

import { google } from "googleapis";
import { supabaseAdmin } from "./supabase";
import { getCredentials, appendLeadRowsToSheet } from "./google-sheets";
import { normalizeOrgTerm } from "./leads";
import { normalizeBuyerType, normalizeCountry, normalizeOrgScale } from "./format";
import { researchOrgProfile } from "./researchOrg";
import { getSegment, sheetOptionsFor, segmentSpreadsheetId, type SegmentKey } from "./segments";

const TRACKER_SPREADSHEET_ID_ENV = "GOOGLE_SHEETS_TRACKER_ID";
const BYRMASTER_TAB = "ByrMaster";
const ENQUIRY_TAB = "EnquiryTracker";

export interface TrackerOrg {
  /** The org name as it should be created (cleanest of any duplicate rows found). */
  org: string;
  country: string | null;
  contact: string | null;
  businessTypeRaw: string | null;
  /** Which tab(s) this org was found in. */
  sources: ("ByrMaster" | "EnquiryTracker")[];
  /** True when an EnquiryTracker row for this org has an Order ID — the
   * signal that this buyer has actually ordered, so belongs in Customers. */
  hasOrderId: boolean;
  targetSegment: Extract<SegmentKey, "engagement" | "customers">;
}

function getSheetsClient() {
  const { client_email, private_key } = getCredentials();
  const auth = new google.auth.JWT({
    email: client_email,
    key: private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return google.sheets({ version: "v4", auth });
}

function trackerSpreadsheetId(): string {
  const id = process.env[TRACKER_SPREADSHEET_ID_ENV];
  if (!id || !id.trim()) {
    throw new Error(
      `${TRACKER_SPREADSHEET_ID_ENV} is not set. Add the Leads&Enqs Tracker spreadsheet id to the environment.`
    );
  }
  return id.trim();
}

/** "Group Beranger (France)" -> { org: "Group Beranger", country: "France" }. */
function splitOrgCountry(raw: string): { org: string; country: string | null } {
  // [\s\S] instead of "." with an "s" flag (unsupported at this tsconfig's
  // target): a handful of tracker cells embed a literal newline in the org
  // name before the "(Country)" suffix, and "." alone won't cross it.
  const m = raw.match(/^([\s\S]*)\s\(([^()]+)\)\s*$/);
  if (m) return { org: m[1].trim().replace(/\s+/g, " "), country: m[2].trim() || null };
  return { org: raw.trim().replace(/\s+/g, " "), country: null };
}

/** Corporate-suffix-stripped, squashed key — the "soft match" tier: catches
 * "Group Beranger" vs "Beranger", "Acme Trading Co" vs "Acme", etc. */
const CORP_SUFFIXES =
  /\b(group|international|intl|trading|holdings?|company|corporation|corp|enterprises?|llc|ltd|pvt|inc|co|pty|sa|nv|bv|gmbh|srl|sarl|sas|kg|ag|oy|ab|plc)\b/g;
function softKey(org: string): string {
  return normalizeOrgTerm(org.toLowerCase().replace(CORP_SUFFIXES, ""));
}

/** Generic words that must never, on their own, justify a "same org" match —
 * this DB has a handful of corrupted single-word org names ("Order",
 * "Style", "Service", "Business", "sister", "Store") left over from a past
 * bad sync, and plain substring containment matched real orgs against them
 * purely by coincidence ("Land[mark ]Group" ~ "mark", "Life[style ]Brand" ~
 * "style"). Word-token matching (see tokenSequenceMatch) already fixes the
 * cross-word-boundary cases; this stoplist covers the same-word-boundary
 * ones where the junk entry IS a genuine whole token. */
const GENERIC_JUNK_WORDS = new Set([
  "order", "style", "store", "service", "services", "business", "sister",
  "shop", "brand", "co", "group", "the", "and", "home", "life",
]);

/** Word tokens after lowercasing + corp-suffix stripping — kept as an array
 * (not squashed) so containment can be checked at word boundaries instead
 * of raw character substrings. */
function wordTokens(org: string): string[] {
  return org
    .toLowerCase()
    .replace(CORP_SUFFIXES, " ")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** True when the shorter token sequence is a whole-word PREFIX or SUFFIX of
 * the longer one ("Amatuli" is a prefix of "Amatuli Artefacts"; "Tekama" is
 * a suffix of "Rem Holding Tekama") — never a mid-string substring, and
 * never justified by a single generic/junk word alone. */
function tokenSequenceMatch(a: string[], b: string[]): boolean {
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (shorter.length === 0 || shorter.length === longer.length) return false;
  if (shorter.length === 1 && GENERIC_JUNK_WORDS.has(shorter[0])) return false;
  if (shorter.join("").length < 4) return false; // too short to trust alone
  const isPrefix = shorter.every((tok, i) => longer[i] === tok);
  const isSuffix = shorter.every((tok, i) => longer[longer.length - shorter.length + i] === tok);
  return isPrefix || isSuffix;
}

/** A raw org cell that means "we don't actually know the name yet" — never
 * a real, creatable organization, regardless of which tab or spelling. */
const PLACEHOLDER_ORG_NAMES = new Set([
  "(not decided yet)",
  "not decided yet",
  "to be determined",
  "tbd",
  "n/a",
  "na",
  "unknown",
  "none",
  "-",
]);
function isPlaceholderOrgName(org: string): boolean {
  return PLACEHOLDER_ORG_NAMES.has(org.trim().toLowerCase());
}

/** Extracts alternate names an org is also known by, so a tracker row for
 * one of them matches the DB's consolidated record instead of registering
 * as a "new" org:
 *   - a "doing business as" suffix: "Retention Brands LLC (DBA Alltrue)" -> "Alltrue"
 *   - a trailing parenthetical listing sibling brands from a manual merge:
 *     "Vision 101 S.A. (Blue Star Group — Isadora, Todomoda)" -> ["Blue Star
 *     Group", "Isadora", "Todomoda"]
 */
function extractAliases(org: string): string[] {
  const aliases: string[] = [];
  const dba = org.match(/\(\s*d\/?b\/?a\.?\s+([^()]+)\)/i) ?? org.match(/\bd\/?b\/?a\.?\s+(.+)$/i);
  if (dba) aliases.push(dba[1].trim());

  const trailingParen = org.match(/\(([^()]+)\)\s*$/);
  if (trailingParen) {
    const parts = trailingParen[1]
      .split(/[—–,/]/)
      .map((s) => s.trim())
      .filter((p) => p.length >= 3 && !/^d\/?b\/?a\b/i.test(p));
    aliases.push(...parts);
  }
  return aliases;
}

/** Levenshtein edit distance, capped — used only as a last-resort tier on
 * the handful of candidates that survive exact/soft/DBA matching, to catch
 * a single-character spelling slip ("Gibson Games" vs "Gibsons Games")
 * without risking a false merge of two genuinely different short names. */
function editDistanceWithinOne(a: string, b: string): boolean {
  if (a === b) return true;
  const lenDiff = Math.abs(a.length - b.length);
  if (lenDiff > 1) return false;
  if (Math.min(a.length, b.length) < 5) return false; // too short to risk it
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    edits++;
    if (edits > 1) return false;
    if (a.length === b.length) {
      i++;
      j++; // substitution
    } else if (a.length > b.length) {
      i++; // deletion from a
    } else {
      j++; // deletion from b
    }
  }
  return true;
}

/** Reads and consolidates both tracker tabs into one deduplicated list of
 * candidate orgs (not yet checked against the DB). */
export async function readTrackerOrgs(): Promise<TrackerOrg[]> {
  const spreadsheetId = trackerSpreadsheetId();
  const sheets = getSheetsClient();

  const [bm, et] = await Promise.all([
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${BYRMASTER_TAB}!A1:J20000`,
      valueRenderOption: "UNFORMATTED_VALUE",
    }),
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${ENQUIRY_TAB}!A1:AC20000`,
      valueRenderOption: "UNFORMATTED_VALUE",
    }),
  ]);

  const raw: TrackerOrg[] = [];

  // ByrMaster: C=Org name, D=Lead Contact Name, F=Lead Source, G=Country, H=Business Type.
  const bmRows = bm.data.values ?? [];
  for (let r = 1; r < bmRows.length; r++) {
    const row = bmRows[r];
    const orgRaw = String(row?.[2] ?? "").trim().replace(/\s+/g, " ");
    if (!orgRaw || isPlaceholderOrgName(orgRaw)) continue;
    raw.push({
      org: orgRaw,
      country: String(row?.[6] ?? "").trim() || null,
      contact: String(row?.[3] ?? "").trim().replace(/\s+/g, " ") || null,
      businessTypeRaw: String(row?.[7] ?? "").trim() || null,
      sources: ["ByrMaster"],
      hasOrderId: false,
      targetSegment: "engagement",
    });
  }

  // EnquiryTracker: K (10)=Buyer Org "Name (Country)", Y (24)=Order ID.
  const etRows = et.data.values ?? [];
  for (let r = 1; r < etRows.length; r++) {
    const row = etRows[r];
    const buyerOrgRaw = String(row?.[10] ?? "").trim();
    if (!buyerOrgRaw) continue;
    const { org, country } = splitOrgCountry(buyerOrgRaw);
    if (!org || isPlaceholderOrgName(org)) continue;
    const orderId = String(row?.[24] ?? "").trim();
    raw.push({
      org,
      country,
      contact: null,
      businessTypeRaw: null,
      sources: ["EnquiryTracker"],
      hasOrderId: !!orderId,
      targetSegment: orderId ? "customers" : "engagement",
    });
  }

  // Consolidate duplicates within the tracker itself (same org named in both
  // tabs, or repeated rows) by soft key. Merge: keep the first org spelling
  // seen, union sources, prefer any non-null country/contact/businessType,
  // and promote to Customers if ANY duplicate has an Order ID.
  const bySoftKey = new Map<string, TrackerOrg>();
  for (const cand of raw) {
    const key = softKey(cand.org) || normalizeOrgTerm(cand.org);
    if (!key) continue;
    const existing = bySoftKey.get(key);
    if (!existing) {
      bySoftKey.set(key, { ...cand, sources: [...cand.sources] });
      continue;
    }
    existing.country = existing.country ?? cand.country;
    existing.contact = existing.contact ?? cand.contact;
    existing.businessTypeRaw = existing.businessTypeRaw ?? cand.businessTypeRaw;
    for (const s of cand.sources) {
      if (!existing.sources.includes(s)) existing.sources.push(s);
    }
    if (cand.hasOrderId) {
      existing.hasOrderId = true;
      existing.targetSegment = "customers";
    }
  }

  return Array.from(bySoftKey.values());
}

/** "https://www.aquanova.com/en" -> "aquanova.com" — strips protocol, "www.",
 * path/query, and a trailing slash so two spellings of the same URL match. */
function normalizeWebsite(url: string | null | undefined): string | null {
  if (!url) return null;
  const v = url.trim().toLowerCase();
  if (!v) return null;
  const noProtocol = v.replace(/^https?:\/\//, "");
  const host = noProtocol.split("/")[0].replace(/^www\./, "");
  return host || null;
}

export interface ExistingOrgKeys {
  exact: Set<string>;
  soft: Set<string>;
  /** Word-token sequences, "|"-joined, for prefix/suffix containment. */
  tokenKeys: Set<string>;
  websites: Set<string>;
}

/** Registers one org name's exact/soft/token keys (and any DBA/sibling-brand
 * aliases baked into it) into an ExistingOrgKeys set. */
function indexOrgName(existing: ExistingOrgKeys, name: string): void {
  for (const n of [name, ...extractAliases(name)]) {
    existing.exact.add(normalizeOrgTerm(n));
    existing.soft.add(softKey(n));
    const tokens = wordTokens(n);
    if (tokens.length) existing.tokenKeys.add(tokens.join("|"));
  }
}

/** Loads every existing Customers/Engagement org's squashed-exact key, soft
 * key, word-token sequence, and website domain, for a cheap in-memory
 * membership check against the tracker. Exported so the create step can
 * re-check the RESOLVED name research comes back with, not just the
 * tracker's raw shorthand name. */
export async function loadExistingOrgKeys(): Promise<ExistingOrgKeys> {
  const existing: ExistingOrgKeys = {
    exact: new Set(),
    soft: new Set(),
    tokenKeys: new Set(),
    websites: new Set(),
  };
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabaseAdmin
      .from("leads")
      .select("organization,website")
      .in("segment", ["engagement", "customers"])
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as { organization: string | null; website: string | null }[];
    for (const r of rows) {
      const domain = normalizeWebsite(r.website);
      if (domain) existing.websites.add(domain);
      if (!r.organization) continue;
      indexOrgName(existing, r.organization);
    }
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return existing;
}

/** Registers a newly-created record's keys in-memory, so the rest of the
 * SAME batch won't turn around and create a second duplicate of it. */
function addToExistingKeys(existing: ExistingOrgKeys, org: string, website: string | null): void {
  indexOrgName(existing, org);
  const domain = normalizeWebsite(website);
  if (domain) existing.websites.add(domain);
}

export interface TrackerDiff {
  newOrgs: TrackerOrg[];
  alreadyMatchedCount: number;
  totalTrackerOrgs: number;
}

/**
 * Every matching tier in one place, reused both pre-research (against the
 * tracker's raw, often-shorthand org name) and post-research (against the
 * name web research actually resolved to) — the second pass matters because
 * research routinely reveals a fuller legal name ("Amatuli" -> "Amatuli
 * Artefacts") that the raw tracker name alone wouldn't have caught.
 */
function matchesExistingOrg(
  org: string,
  existing: { exact: Set<string>; soft: Set<string>; tokenKeys: Set<string> }
): boolean {
  const exactKey = normalizeOrgTerm(org);
  const soft = softKey(org);
  if (exactKey && existing.exact.has(exactKey)) return true;
  if (soft && existing.soft.has(soft)) return true;

  // Containment tier: one org's word-token sequence is a whole-word prefix
  // or suffix of the other's ("Amatuli" -> "Amatuli Artefacts", "Tekama" ->
  // "Rem Holding Tekama") — catches a shorthand/legal-name mismatch the
  // corp-suffix strip doesn't cover. Word-boundary-aware (not a raw
  // character substring) so it can't cross into an unrelated word the way
  // "andmark" would inside "landmark groups", and tokenSequenceMatch itself
  // refuses to let a single generic/junk word carry the whole match.
  const tokens = wordTokens(org);
  if (
    tokens.length &&
    Array.from(existing.tokenKeys).some((k) => tokenSequenceMatch(tokens, k.split("|")))
  ) {
    return true;
  }

  // A hyphen-joined token exactly matches an existing org on its own —
  // catches ByrMaster's "OrgName-ContactFirstName" convention
  // ("Envogue-Manoj", "Tanha - Envogue") without risking a false match on
  // an org whose real name merely contains a hyphen: each token must
  // match a WHOLE existing org, not a substring of one.
  if (
    org.includes("-") &&
    org
      .split("-")
      .map((tok) => softKey(tok))
      .some((tok) => tok.length >= 3 && existing.soft.has(tok))
  ) {
    return true;
  }

  // Last-resort tier: a single-character spelling slip against an existing
  // org ("Gibson Games" vs the already-created "Gibsons Games").
  if (soft && Array.from(existing.soft).some((k) => editDistanceWithinOne(soft, k))) {
    return true;
  }

  return false;
}

/** Dry-run pass: tracker orgs with no Customers/Engagement counterpart. */
export async function diffTrackerAgainstDb(): Promise<TrackerDiff> {
  const [trackerOrgs, existing] = await Promise.all([
    readTrackerOrgs(),
    loadExistingOrgKeys(),
  ]);

  const newOrgs = trackerOrgs.filter((t) => !matchesExistingOrg(t.org, existing));

  return {
    newOrgs,
    alreadyMatchedCount: trackerOrgs.length - newOrgs.length,
    totalTrackerOrgs: trackerOrgs.length,
  };
}

export interface CreateFromTrackerResult {
  org: string;
  ok: boolean;
  id?: number;
  segment?: string;
  /** Set when research resolved this to an org (or website) that already
   * exists — nothing was created, and this isn't counted as a failure. */
  duplicateOf?: string;
  error?: string;
}

/**
 * Researches and creates ONE tracker org as a new lead — Supabase insert +
 * an append to that segment's own Google Sheet tab, so it survives the next
 * full segment Sync (which reads the sheet fresh and replaces the segment).
 *
 * `existing` is mutated in place on a successful create (see
 * addToExistingKeys) so the REST of the same batch also sees it — without
 * this, two tracker rows for the same org researched back-to-back would
 * both sail through the pre-research diff and create two records.
 */
export async function createOrgFromTracker(
  candidate: TrackerOrg,
  existing: ExistingOrgKeys
): Promise<CreateFromTrackerResult> {
  try {
    const { row } = await researchOrgProfile({
      org: candidate.org,
      country: candidate.country ?? undefined,
      buyerName: candidate.contact ?? undefined,
    });

    // Safety re-check: research often resolves a shorthand tracker name to
    // the company's fuller legal name ("Amatuli" -> "Amatuli Artefacts"),
    // which is exactly the case the pre-research diff can miss. Re-run the
    // same matching against what research actually found, PLUS a website
    // check (a shared domain is as strong a signal as a name match).
    const resolvedOrg = row.organization ?? candidate.org;
    const resolvedDomain = normalizeWebsite(row.website);
    const alreadyExists =
      matchesExistingOrg(resolvedOrg, existing) ||
      (resolvedDomain && existing.websites.has(resolvedDomain));
    if (alreadyExists) {
      return {
        org: candidate.org,
        ok: false,
        duplicateOf: resolvedOrg,
      };
    }

    row.country = normalizeCountry(row.country);
    row.org_scale = normalizeOrgScale(row.org_scale);
    row.buyer_type = normalizeBuyerType(row.buyer_type);

    const seg = getSegment(candidate.targetSegment);
    if (!seg) throw new Error(`Unknown segment "${candidate.targetSegment}".`);

    const record = {
      ...row,
      segment: candidate.targetSegment,
      source: "Leads&Enqs Tracker",
      imported_at: new Date().toISOString(),
      enriched_at: new Date().toISOString(),
      notes: `Created from Leads&Enqs Tracker (${candidate.sources.join(" + ")}).`,
      notes_updated_at: new Date().toISOString(),
      notes_updated_by: "Tracker Sync",
    };

    const { data, error } = await supabaseAdmin
      .from("leads")
      .insert(record)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const id = data?.id as number;

    // Dual-write to the segment's own sheet so this survives the next Sync.
    const spreadsheetId = segmentSpreadsheetId(seg);
    if (spreadsheetId) {
      const sheetOpts = sheetOptionsFor(seg);
      await appendLeadRowsToSheet(spreadsheetId, [record], sheetOpts);
    }

    addToExistingKeys(existing, resolvedOrg, row.website);

    return { org: candidate.org, ok: true, id, segment: candidate.targetSegment };
  } catch (err) {
    return {
      org: candidate.org,
      ok: false,
      error: err instanceof Error ? err.message : "Failed to create.",
    };
  }
}
