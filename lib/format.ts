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
  ukraine: "UA",
  vietnam: "VN",
};

/** Country name -> ISO-3166 alpha-2 code, or null when unknown. */
export function countryIso(country: string | null | undefined): string | null {
  if (!country) return null;
  return COUNTRY_TO_ISO[country.trim().toLowerCase()] ?? null;
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
