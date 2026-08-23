/**
 * Display formatting helpers: country flag emoji + relative dates.
 * Pure functions, safe in client components.
 */

const COUNTRY_TO_ISO: Record<string, string> = {
  "united states": "US",
  usa: "US",
  "united states of america": "US",
  "united kingdom": "GB",
  uk: "GB",
  "great britain": "GB",
  england: "GB",
  "united arab emirates": "AE",
  uae: "AE",
  "saudi arabia": "SA",
  ksa: "SA",
  australia: "AU",
  austria: "AT",
  bahrain: "BH",
  belgium: "BE",
  brazil: "BR",
  canada: "CA",
  chile: "CL",
  china: "CN",
  colombia: "CO",
  "czech republic": "CZ",
  denmark: "DK",
  egypt: "EG",
  finland: "FI",
  france: "FR",
  germany: "DE",
  greece: "GR",
  "hong kong": "HK",
  hungary: "HU",
  india: "IN",
  indonesia: "ID",
  ireland: "IE",
  israel: "IL",
  italy: "IT",
  japan: "JP",
  jordan: "JO",
  kenya: "KE",
  kuwait: "KW",
  lebanon: "LB",
  malaysia: "MY",
  mexico: "MX",
  morocco: "MA",
  netherlands: "NL",
  "new zealand": "NZ",
  nigeria: "NG",
  norway: "NO",
  oman: "OM",
  pakistan: "PK",
  philippines: "PH",
  poland: "PL",
  portugal: "PT",
  qatar: "QA",
  romania: "RO",
  russia: "RU",
  singapore: "SG",
  "south africa": "ZA",
  "south korea": "KR",
  korea: "KR",
  spain: "ES",
  "sri lanka": "LK",
  sweden: "SE",
  switzerland: "CH",
  taiwan: "TW",
  thailand: "TH",
  turkey: "TR",
  "türkiye": "TR",
  ukraine: "UA",
  vietnam: "VN",
  "viet nam": "VN",
  // Latin America
  argentina: "AR",
  peru: "PE",
  uruguay: "UY",
  ecuador: "EC",
  paraguay: "PY",
  bolivia: "BO",
  venezuela: "VE",
  "costa rica": "CR",
  panama: "PA",
  guatemala: "GT",
  honduras: "HN",
  "el salvador": "SV",
  nicaragua: "NI",
  "dominican republic": "DO",
  "puerto rico": "PR",
  // Africa & Middle East
  mauritius: "MU",
  tunisia: "TN",
  algeria: "DZ",
  ghana: "GH",
  tanzania: "TZ",
  ethiopia: "ET",
  senegal: "SN",
  rwanda: "RW",
  uganda: "UG",
  "ivory coast": "CI",
  "côte d'ivoire": "CI",
  // Asia
  bangladesh: "BD",
  nepal: "NP",
  cambodia: "KH",
  myanmar: "MM",
  kazakhstan: "KZ",
  uzbekistan: "UZ",
  // Europe
  czechia: "CZ",
  croatia: "HR",
  serbia: "RS",
  slovakia: "SK",
  slovenia: "SI",
  bulgaria: "BG",
  lithuania: "LT",
  latvia: "LV",
  estonia: "EE",
  luxembourg: "LU",
  iceland: "IS",
  cyprus: "CY",
  malta: "MT",
};

/**
 * Extract the priority/confidence tier from a graded value.
 *
 * The sheet's AI rating now arrives as a full sentence
 * ("LOW — … no signal to lift it higher.", "HIGH — …"), so a naive
 * `includes("HIGH")` wrongly matches the word "higher" inside LOW/MED text.
 * The tier is always the LEADING word, so anchor the match to the start.
 */
export function classificationTier(
  value: string | null | undefined
): "HIGH" | "MEDIUM" | "LOW" | null {
  const s = String(value ?? "").trim().toUpperCase();
  if (/^HIGH\b/.test(s)) return "HIGH";
  if (/^MED/.test(s)) return "MEDIUM"; // MED or MEDIUM
  if (/^LOW\b/.test(s)) return "LOW";
  return null;
}

/** Country name -> ISO-3166 alpha-2 code, or null when unknown. */
export function countryIso(country: string | null | undefined): string | null {
  if (!country) return null;
  return COUNTRY_TO_ISO[country.trim().toLowerCase()] ?? null;
}

/**
 * Known alias spellings for a country that would otherwise create duplicate
 * entries in a filter/dropdown (e.g. "United States" vs "United States (US)"
 * vs a typo like "Unites States (US)"). Maps a lowercased alias to ONE
 * canonical display name. Extend this list as new duplicate spellings show
 * up in a sync — it is intentionally short, covering only spellings actually
 * seen in the data, not an exhaustive ISO alias table.
 */
const COUNTRY_ALIASES: Record<string, string> = {
  us: "United States",
  usa: "United States",
  "u.s.a.": "United States",
  "u.s.": "United States",
  "united states": "United States",
  "united states of america": "United States",
  "united states (us)": "United States",
  "unites states (us)": "United States", // observed typo in a source sheet
  uk: "United Kingdom",
  "u.k.": "United Kingdom",
  "united kingdom": "United Kingdom",
  "united kingdom (uk)": "United Kingdom",
  "great britain": "United Kingdom",
  uae: "United Arab Emirates",
  "u.a.e.": "United Arab Emirates",
  "united arab emirates": "United Arab Emirates",
  "united arab emirates (uae)": "United Arab Emirates",
  "south korea": "South Korea",
  "korea, republic of": "South Korea",
  "republic of korea": "South Korea",
  "hong kong": "Hong Kong",
  "hong kong sar": "Hong Kong",
  "czech republic": "Czech Republic",
  czechia: "Czech Republic",
};

/**
 * Normalize a country value to one canonical spelling, so a filter never
 * lists the same country twice under different names. Applied at sync time
 * (lib/google-sheets.ts) to every incoming "country" cell, for every segment.
 * Not a validator — an unrecognised value passes through unchanged (trimmed
 * only), it does not attempt to detect or fix garbage data.
 */
export function normalizeCountry(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  return COUNTRY_ALIASES[v.toLowerCase()] ?? v;
}

/** Known alias spellings for org-size tier that would otherwise create
 * duplicate entries in the "Buyer Org Size Tier" filter (e.g. "Medium" vs
 * "Medium Enterprise" for the same tier). Canonical forms match the ones
 * already used across the app (Individual / Large/ENT / Medium / Micro /
 * Not Available / Small). */
const ORG_SCALE_ALIASES: Record<string, string> = {
  "small enterprise": "Small",
  "medium enterprise": "Medium",
  "large enterprise": "Large/ENT",
  large: "Large/ENT",
  "micro enterprise": "Micro",
  // "Unknown" is one source sheet's spelling of the same "no data" concept
  // every other segment already calls "Not Available".
  unknown: "Not Available",
};

/** Normalize an org-size value to one canonical spelling, so a filter never
 * lists the same tier twice under different names. Applied at sync time
 * (lib/google-sheets.ts), same spirit as normalizeCountry. */
export function normalizeOrgScale(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  return ORG_SCALE_ALIASES[v.toLowerCase()] ?? v;
}

/** "Unknown" -> "Not Available", the canonical "no data" label already used
 * for buyer type across the app. Applied at sync time so a future import
 * can't reintroduce the split. */
export function normalizeBuyerType(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  return v.toLowerCase() === "unknown" ? "Not Available" : v;
}

/**
 * Reject values in the AM (Account Manager) field that are clearly not a
 * person's name — an email subject line that leaked in from a shifted source
 * column ("Re: Following up on your RFQ...", "Qalara shipment | GB100... |
 * Delivered"), or a raw placeholder like "NOT ASSIGNED". Falls back to the
 * standard "No Active AM" placeholder already used throughout the app.
 * Deliberately conservative — only rejects unambiguous junk patterns, since a
 * false positive would silently unassign a real AM; a genuine short name
 * (even an unfamiliar one) passes through unchanged.
 */
export function sanitizeAmValue(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  const lower = v.toLowerCase();
  if (lower === "not assigned" || lower === "unassigned") return "No Active AM";
  const looksLikeJunk =
    v.includes("|") ||
    /^(re|fwd)\s*:/i.test(v) ||
    v.length > 40; // real names are short; subject lines/sentences aren't
  return looksLikeJunk ? "No Active AM" : v;
}

/** "2026-06-12T08:15:00Z" -> "12 Jun 2026, 1:45 pm IST". */
export function formatIst(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return (
    new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d) + " IST"
  );
}

/**
 * Pick ONE email from a multi-email field: prefer the address that matches
 * the buyer's name (e.g. "gabor.bottka@…" for Gabor), else the first on file.
 * Used by the table's email column and the dossier header.
 */
export function primaryEmail(
  email: string | null | undefined,
  fullName: string | null | undefined
): string | null {
  const emails = (email ?? "")
    .split(/[;,/]|\s+/)
    .map((e) => e.trim())
    .filter((e) => e.includes("@"));
  if (emails.length === 0) return null;
  const nameTokens = (fullName ?? "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((t) => t.length >= 3);
  return (
    emails.find((e) =>
      nameTokens.some((t) => e.toLowerCase().split("@")[0].includes(t))
    ) ?? emails[0]
  );
}

/** "2025-03-12" -> "3 mo ago". Null when the value isn't a parseable date. */
export function relativeDate(value: string | null | undefined): string | null {
  if (!value) return null;
  // Tolerate annotated dates like "2026-06-11 · via sourcing@qalara".
  const iso = value.match(/\d{4}-\d{2}-\d{2}/);
  const d = new Date(iso ? iso[0] : value.trim());
  if (isNaN(d.getTime())) return null;
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days < 0) return null;
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mo ago`;
  const years = Math.floor(days / 365);
  const rem = Math.floor((days - years * 365) / 30);
  return rem > 0 ? `${years} yr ${rem} mo ago` : `${years} yr ago`;
}
