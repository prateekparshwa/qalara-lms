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
  canada: "Canada", // observed all-lowercase in a source row
  mauritius: "Mauritius", // observed all-caps in a source row
  "trinidad & tobago": "Trinidad and Tobago",
  "state of palestine": "Palestine",
  // City/region qualifiers a researcher appended in parentheses — same
  // country, just more detail than this field is meant to hold.
  "united kingdom (brigg, lincolnshire)": "United Kingdom",
  "united kingdom (london)": "United Kingdom",
  "united kingdom (sutton, surrey)": "United Kingdom",
  "united states (likely dublin, oh based on facebook location)": "United States",
  "united states (new york)": "United States",
  "usa (mesa, arizona)": "United States",
  "usa (new york)": "United States",
  "usa (philadelphia, pennsylvania)": "United States",
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
  enterprise: "Large/ENT",
  "mid to large": "Large/ENT",
  mid: "Medium",
  "micro enterprise": "Micro",
  // "Unknown" is one source sheet's spelling of the same "no data" concept
  // every other segment already calls "Not Available".
  unknown: "Not Available",
  // One-off researcher annotations appended in parentheses — same tier,
  // just more detail than this field is meant to hold.
  "small (described as 'a small boutique' on the website)": "Small",
  "small (estimate)": "Small",
  "small (solo influencer/creator)": "Small",
  "small to mid (family-owned, private limited company)": "Small",
};

/** Normalize an org-size value to one canonical spelling, so a filter never
 * lists the same tier twice under different names. Applied at sync time
 * (lib/google-sheets.ts), same spirit as normalizeCountry. */
export function normalizeOrgScale(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  return ORG_SCALE_ALIASES[v.toLowerCase()] ?? v;
}

/**
 * Alias map collapsing every spelling variant / near-duplicate business-type
 * value seen in the source data down to the 14 official categories defined
 * in the "Buyer Business Type Criteria" tab of the Qualified Leads workbook
 * (the documented, authoritative label set for this column), plus "Others"
 * which is kept as its own bucket since it's a deliberate ByrMaster answer
 * ("doesn't fit any category"), not missing data.
 *
 * ByrMaster's own raw dropdown ("Retailer", "Wholesale / Importer", "Amazon
 * Seller", "Boutique Store", "Horeca Wholesale", etc.) uses entirely
 * different wording from the Qualified Leads canonical set, and earlier
 * one-off enrichment passes wrote inconsistent free text on top of that —
 * this map absorbs both sources into one clean, deduplicated list so the
 * "Buyer Business Type" filter never lists near-identical entries twice.
 */
const BUYER_TYPE_ALIASES: Record<string, string> = {
  unknown: "Not Available",

  // --- Digital / Online retailer ---
  "digital/ online retailer": "Digital / Online retailer",
  "online retailer": "Digital / Online retailer",
  "online / e-commerce": "Digital / Online retailer",
  "online / e-commerce (affiliate/influencer)": "Digital / Online retailer",
  "online marketplace": "Digital / Online retailer",
  "online marketplace / subscription box retailer": "Digital / Online retailer",
  "online retailer (ethical/artisan home decor)": "Digital / Online retailer",
  "manufacturer / online retailer": "Digital / Online retailer",
  "amazon seller": "Digital / Online retailer",
  "subscription box": "Digital / Online retailer",

  // --- Independent / Boutique owner ---
  "independent/ boutique owner": "Independent / Boutique owner",
  "boutique store": "Independent / Boutique owner",
  "fashion boutique / retailer": "Independent / Boutique owner",
  "gift shop / boutique retail (physical, some online ordering)":
    "Independent / Boutique owner",
  "retail store / artisan collective": "Independent / Boutique owner",

  // --- Brick-and-mortar / Multi-channel retailer ---
  "brick-and-mortar / multi channel retailer":
    "Brick-and-mortar / Multi-channel retailer",
  "brick-and-mortar / manufacturer & builder":
    "Brick-and-mortar / Multi-channel retailer",
  "brick-and-mortar / online retailer": "Brick-and-mortar / Multi-channel retailer",
  "brick-and-mortar retailer; manufacturer":
    "Brick-and-mortar / Multi-channel retailer",
  "large off-price retail chain": "Brick-and-mortar / Multi-channel retailer",
  "large supermarket / department store chain":
    "Brick-and-mortar / Multi-channel retailer",
  "retail store": "Brick-and-mortar / Multi-channel retailer",
  "retail store (closed)": "Brick-and-mortar / Multi-channel retailer",
  "retail store / brand": "Brick-and-mortar / Multi-channel retailer",
  retailer: "Brick-and-mortar / Multi-channel retailer",
  "multi-channel retailer": "Brick-and-mortar / Multi-channel retailer",
  "multi-channel retailer (brick-and-mortar and e-commerce)":
    "Brick-and-mortar / Multi-channel retailer",
  "multi-channel retailer (brick-and-mortar boutique and e-commerce)":
    "Brick-and-mortar / Multi-channel retailer",
  "multi-channel retailer; online / e-commerce":
    "Brick-and-mortar / Multi-channel retailer",
  "multi-channel retailer; online / e-commerce; brick-and-mortar showroom":
    "Brick-and-mortar / Multi-channel retailer",
  "online / e-commerce; multi-channel retailer":
    "Brick-and-mortar / Multi-channel retailer",
  "online / e-commerce; subscription box service; multi-channel retailer":
    "Brick-and-mortar / Multi-channel retailer",
  "domestic retailer": "Brick-and-mortar / Multi-channel retailer",

  // --- Retailer & Wholesaler (does both B2C and B2B) ---
  both: "Retailer & Wholesaler",
  "multi-channel retailer (direct-to-consumer via website and wholesale to retailers)":
    "Retailer & Wholesaler",
  "wholesale distributor; online / retailer": "Retailer & Wholesaler",

  // --- Wholesaler / Importer ---
  "whole-seller / importer": "Wholesaler / Importer",
  "wholesale / importer": "Wholesaler / Importer",
  "b2b / wholesale distributor": "Wholesaler / Importer",
  "closeout wholesaler": "Wholesaler / Importer",
  "trading company / wholesaler": "Wholesaler / Importer",
  "manufacturer / b2b wholesale": "Wholesaler / Importer",
  "import/distribution company (cosmetics/personal care)":
    "Wholesaler / Importer",
  importer: "Wholesaler / Importer",
  "trading company (it / technology)": "Wholesaler / Importer",
  "trading company (uniforms, safety wear, gifts)": "Wholesaler / Importer",
  "stock clearance / liquidation company": "Wholesaler / Importer",
  "manufacturer / distributor (subsidiary)": "Wholesaler / Importer",
  "corporate gifting / merchandise company": "Wholesaler / Importer",
  "corporate gifting company": "Wholesaler / Importer",
  "corporate gifting distributor": "Wholesaler / Importer",
  "corporate gifting distributor / reseller": "Wholesaler / Importer",
  "indian exporter": "Wholesaler / Importer",
  "liaison office": "Wholesaler / Importer",
  "horeca wholesale": "Wholesaler / Importer",

  // --- Lifestyle brand ---
  "brand / publisher of stationery and giftware": "Lifestyle brand",
  "brand / retailer": "Lifestyle brand",
  "corporate gifting brand": "Lifestyle brand",
  "manufacturer / d2c retailer": "Lifestyle brand",
  "manufacturer / publisher": "Lifestyle brand",
  "retailer / brand": "Lifestyle brand",
  "brand aggregator": "Lifestyle brand",

  // --- Architect / Interior Designer ---
  "architect/ interior designer": "Architect / Interior Designer",
  "interior designer": "Architect / Interior Designer",
  architect: "Architect / Interior Designer",
  designer: "Architect / Interior Designer",

  // --- Hotel, Restaurant, Cafe ---
  "hotelier/ architect": "Hotel, Restaurant, Cafe",

  // --- Buying Agent ---
  "sourcing agent": "Buying Agent",
  agent: "Buying Agent",
  "buying house": "Buying Agent",

  // --- Buying Team (kept distinct from Buying Agent per explicit call —
  // an internal buying/procurement team is not an external agent) ---
  "buying team": "Buying Team",

  // --- Marketing / Advertising Agency ---
  "agency / service provider": "Marketing / Advertising Agency",

  // --- No reliable signal / off-category for this taxonomy ---
  "aquaculture biotechnology / animal nutrition company": "Not Available",
  "event logistics / freight company": "Not Available",
  "fintech / payments company (government-linked)": "Not Available",
  "industrial technology / iot hardware company": "Not Available",
  "logistics / courier / hauling company": "Not Available",
  "travel & meetings/events management company": "Not Available",
  "vendor ++": "Not Available",
};

/** Collapses spelling variants of the same business type (ByrMaster's raw
 * dropdown wording, and one-off free text from enrichment) down to the 14
 * official categories from the "Buyer Business Type Criteria" tab, plus the
 * distinct "Others" bucket. Applied at sync time so a future import can't
 * reintroduce a duplicate. "Others" and already-canonical values pass
 * through unchanged. */
export function normalizeBuyerType(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  return BUYER_TYPE_ALIASES[v.toLowerCase()] ?? v;
}

/**
 * First-name-only entries that are unambiguously the same person as one
 * (and only one) fuller name already in the data — merged so the Account
 * Manager filter doesn't list the same person twice. Deliberately narrow:
 * a bare first name shared by two different AMs (e.g. "Neha" — both
 * "Neha G" and "Neha Kaushik" exist) is left alone rather than guessed at,
 * since misattributing a real person's assignment is a real data-integrity
 * risk, not just a cosmetic filter issue.
 */
const AM_ALIASES: Record<string, string> = {
  himanshu: "Himanshu Sahu",
  gouri: "Gouri Sree",
  raina: "Raina Singhwi",
  roopali: "Roopali Varma",
  prasad: "Prasad Vaidyanathan",
  ashraf: "Ashraf Hamid",
  sunny: "Sunny Shah",
  srijaa: "Srijaa Sundararajan",
  gunjan: "Gunjan Kumari",
  "dilip": "Dilip BR",
  "dilip b r": "Dilip BR", // canonical spelling picked by count (86 vs 65)
  "shivanjali bhute": "Shivanjali Bhute", // casing typo only
};

/**
 * Reject values in the AM (Account Manager) field that are clearly not a
 * person's name — an email subject line that leaked in from a shifted source
 * column ("Re: Following up on your RFQ...", "Qalara shipment | GB100... |
 * Delivered"), or a raw placeholder like "NOT ASSIGNED". Falls back to the
 * standard "No Active AM" placeholder already used throughout the app.
 * Deliberately conservative — only rejects unambiguous junk patterns, since a
 * false positive would silently unassign a real AM; a genuine short name
 * (even an unfamiliar one) passes through unchanged.
 *
 * Also collapses known same-person spelling variants (AM_ALIASES) so the
 * filter never lists one AM under two names.
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
  if (looksLikeJunk) return "No Active AM";
  return AM_ALIASES[lower] ?? v;
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
