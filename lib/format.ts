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

/** Country name -> flag emoji, or null when unknown. */
export function countryFlag(country: string | null | undefined): string | null {
  if (!country) return null;
  const iso = COUNTRY_TO_ISO[country.trim().toLowerCase()];
  if (!iso) return null;
  // Each ISO letter maps to a regional-indicator codepoint.
  return String.fromCodePoint(
    ...iso.split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}

/** "2025-03-12" -> "3 mo ago". Null when the value isn't a parseable date. */
export function relativeDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value.trim());
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
