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
