/**
 * Apify Contact Details Scraper (server-only) — deep-crawls a company site
 * (contact/about pages included) and returns emails, phones, and social
 * profiles. Fills the email/phone/LinkedIn channels when Hunter and vibe
 * prospecting found a person but no direct contact details — note it returns
 * channels only, never names or job titles.
 *
 * Fails soft (null) when APIFY_API_TOKEN is missing/placeholder, on any API
 * error, or when the synchronous run exceeds the 45s abort window.
 */

const DEFAULT_ACTOR = "vdrmota~contact-info-scraper";
// harvestapi/linkedin-profile-scraper — profile details + email, no cookies.
const LINKEDIN_ACTOR = "LpVuK3Zozwuipa5bp";

export interface ApifyContacts {
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
}

interface ApifyItem {
  emails?: string[];
  phones?: string[];
  phonesUncertain?: string[];
  linkedIns?: string[];
}

export interface LinkedInProfile {
  full_name: string | null;
  designation: string | null;
  email: string | null;
}

function str(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s && s.toLowerCase() !== "null" ? s : null;
}

/**
 * Scrape one LinkedIn *person* profile (URL must contain /in/) via the
 * "LinkedIn Profile Scraper + Email" actor. Used when vibe prospecting found
 * a person's LinkedIn but no email. Fails soft on any error.
 */
export async function apifyLinkedInProfile(
  profileUrl: string
): Promise<LinkedInProfile | null> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token || token.startsWith("your_")) return null;
  if (!/linkedin\.com\/in\//i.test(profileUrl)) return null; // person pages only

  const url = `https://api.apify.com/v2/acts/${LINKEDIN_ACTOR}/run-sync-get-dataset-items?token=${encodeURIComponent(
    token
  )}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileScraperMode: "Profile details + email search ($10 per 1k)",
        queries: [profileUrl],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const items = (await res.json()) as Record<string, unknown>[];
    const p = Array.isArray(items) ? items[0] : null;
    if (!p) return null;

    const fullName =
      str(p.name) ??
      ([str(p.firstName), str(p.lastName)].filter(Boolean).join(" ") || null);
    // Output shape varies by actor version — check the common email spots.
    const emails = (p.emails ?? p.contactEmails) as unknown;
    const email =
      str(p.email) ??
      (Array.isArray(emails) ? str(emails[0]) : null);
    const designation =
      str(p.headline) ??
      str((p.currentPosition as Record<string, unknown> | undefined)?.title);

    if (!fullName && !email) return null;
    return { full_name: fullName, designation, email };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function apifyContactScrape(
  domain: string
): Promise<ApifyContacts | null> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token || token.startsWith("your_") || !domain) return null;

  const actor = (process.env.APIFY_CONTACT_ACTOR || DEFAULT_ACTOR).replace(
    "/",
    "~"
  );
  const url = `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${encodeURIComponent(
    token
  )}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startUrls: [{ url: `https://${domain}` }],
        maxRequestsPerWebsite: 5,
        sameDomain: true,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const items = (await res.json()) as ApifyItem[];
    if (!Array.isArray(items) || items.length === 0) return null;

    const emails = items.flatMap((i) => i.emails ?? []);
    const phones = items.flatMap((i) => i.phones ?? []);
    const linkedIns = items.flatMap((i) => i.linkedIns ?? []);

    // Prefer an email on the company's own domain.
    const onDomain = emails.find((e) =>
      e.toLowerCase().endsWith(`@${domain.toLowerCase()}`)
    );
    const result: ApifyContacts = {
      email: (onDomain || emails[0] || null)?.toLowerCase() ?? null,
      phone: phones[0] ?? null,
      linkedin_url: linkedIns[0] ?? null,
    };
    return result.email || result.phone || result.linkedin_url ? result : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
