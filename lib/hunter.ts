/**
 * Hunter.io helper (server-only) — find a company's decision-maker email by
 * domain. Hunter's Domain Search returns named people with job titles, so we
 * can rank toward procurement/sourcing/buying roles. Works on the free plan
 * (25 searches/mo). No phone numbers from Hunter (Firecrawl fallback covers that).
 */
import type { DecisionMaker } from "./apollo";

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

interface HunterEmail {
  value?: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  department?: string;
  seniority?: string;
  confidence?: number;
  linkedin?: string;
  phone_number?: string;
}

function rank(e: HunterEmail): number {
  const t = `${e.position ?? ""} ${e.department ?? ""}`.toLowerCase();
  const idx = PRIORITY.findIndex((p) => t.includes(p));
  if (idx !== -1) return idx; // 0..6 — best
  // No procurement title: fall back to confidence (higher = better).
  return 50 - (e.confidence ?? 0) / 100;
}

async function hunterDomainSearch(
  cleanDomain: string,
  key: string
): Promise<HunterEmail[]> {
  // Free plan caps domain-search at 10 results; requesting more 400s.
  const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(
    cleanDomain
  )}&limit=10&api_key=${encodeURIComponent(key)}`;

  const res = await fetch(url);
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      j?.errors?.[0]?.details || j?.errors?.[0]?.code || `Hunter ${res.status}`;
    throw new Error(String(msg));
  }
  return (j?.data?.emails ?? []) as HunterEmail[];
}

export async function findContactViaHunter(
  domain: string
): Promise<DecisionMaker | null> {
  // Primary key first; spare key takes over when the primary errors
  // (rate limit / monthly quota exhausted on the free plan).
  const keys = [
    process.env.HUNTER_API_KEY,
    process.env.HUNTER_API_KEY_BACKUP,
  ].filter((k): k is string => Boolean(k));
  if (keys.length === 0 || !domain) return null;
  const cleanDomain = domain
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/\/.*$/, "");

  let emails: HunterEmail[] = [];
  let lastErr: unknown = null;
  for (const key of keys) {
    try {
      emails = await hunterDomainSearch(cleanDomain, key);
      lastErr = null;
      break;
    } catch (e) {
      lastErr = e;
    }
  }
  if (lastErr) throw lastErr;
  if (emails.length === 0) return null;

  const best = [...emails].sort((a, b) => rank(a) - rank(b))[0];
  const fullName =
    [best.first_name, best.last_name].filter(Boolean).join(" ") || null;

  return {
    full_name: fullName,
    designation: best.position ?? null,
    email: best.value ?? null,
    phone: best.phone_number ?? null,
    linkedin_url: best.linkedin ?? null,
    source: "Hunter.io",
  };
}
