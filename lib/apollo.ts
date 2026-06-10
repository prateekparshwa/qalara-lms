/**
 * Apollo.io people-data helper (server-only) — find a decision-maker for a
 * company by domain + title, then reveal a verified email (and phone if the
 * plan allows). Fails soft: returns whatever it could resolve, or null.
 *
 * Note: revealing emails/phones consumes Apollo credits.
 */

const BASE = "https://api.apollo.io/api/v1";

// Titles we search for, decision-makers first.
const SEARCH_TITLES = [
  "Procurement Manager",
  "Sourcing Manager",
  "Purchasing Manager",
  "Head of Procurement",
  "Head of Sourcing",
  "Buyer",
  "Category Manager",
  "Merchandiser",
  "Supply Chain Manager",
  "Founder",
  "Owner",
  "CEO",
  "Managing Director",
];

// Ranking: prefer real procurement/sourcing roles over generic leadership.
const PRIORITY = [
  "procurement",
  "sourcing",
  "purchasing",
  "buyer",
  "supply chain",
  "merchand",
  "category",
  // Leadership fallbacks — at small importers the founder/owner IS the buyer.
  "founder",
  "owner",
  "managing director",
  "ceo",
  "director",
];

export interface DecisionMaker {
  full_name: string | null;
  designation: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  source: string;
}

function apolloHeaders(key: string) {
  return {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache",
    // Apollo requires the key in this exact header.
    "X-Api-Key": key,
  };
}

function validEmail(e: unknown): string | null {
  const s = String(e ?? "").trim().toLowerCase();
  if (!s || !s.includes("@")) return null;
  if (s.includes("email_not_unlocked") || s.includes("domain.com")) return null;
  return s;
}

function rankScore(title: string): number {
  const t = title.toLowerCase();
  const idx = PRIORITY.findIndex((p) => t.includes(p));
  return idx === -1 ? 99 : idx;
}

interface ApolloPerson {
  first_name?: string;
  last_name?: string;
  name?: string;
  title?: string;
  email?: string;
  linkedin_url?: string;
  phone_numbers?: { sanitized_number?: string; raw_number?: string }[];
}

function phoneOf(p: ApolloPerson | undefined): string | null {
  const n = p?.phone_numbers?.[0];
  const v = n?.sanitized_number || n?.raw_number;
  return v ? String(v) : null;
}

export async function findDecisionMaker(
  domain: string,
  orgName?: string
): Promise<DecisionMaker | null> {
  const key = process.env.APOLLO_API_KEY;
  if (!key || !domain) return null;
  const cleanDomain = domain.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "");

  // 1. Search people at this company by title.
  let people: ApolloPerson[] = [];
  try {
    const res = await fetch(`${BASE}/mixed_people/search`, {
      method: "POST",
      headers: apolloHeaders(key),
      body: JSON.stringify({
        q_organization_domains: cleanDomain,
        person_titles: SEARCH_TITLES,
        page: 1,
        per_page: 10,
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(j?.error || j?.message || `Apollo search ${res.status}`);
    }
    people = (j?.people ?? []) as ApolloPerson[];
  } catch (err) {
    throw err instanceof Error ? err : new Error("Apollo search failed.");
  }

  if (people.length === 0) return null;

  // 2. Pick the best-ranked decision-maker.
  const best = [...people].sort(
    (a, b) => rankScore(a.title ?? "") - rankScore(b.title ?? "")
  )[0];

  const fullName =
    best.name ||
    [best.first_name, best.last_name].filter(Boolean).join(" ") ||
    null;

  let email = validEmail(best.email);
  let phone = phoneOf(best);

  // 3. Enrich to reveal email/phone if the search result was masked.
  if (!email || !phone) {
    try {
      const res = await fetch(`${BASE}/people/match`, {
        method: "POST",
        headers: apolloHeaders(key),
        body: JSON.stringify({
          first_name: best.first_name,
          last_name: best.last_name,
          name: fullName,
          domain: cleanDomain,
          organization_name: orgName,
          reveal_personal_emails: true,
        }),
      });
      const j = await res.json().catch(() => ({}));
      const person = j?.person as ApolloPerson | undefined;
      if (person) {
        email = email || validEmail(person.email);
        phone = phone || phoneOf(person);
      }
    } catch {
      /* keep search-level data */
    }
  }

  return {
    full_name: fullName,
    designation: best.title ?? null,
    email,
    phone,
    linkedin_url: best.linkedin_url ?? null,
    source: "Apollo.io",
  };
}
