/**
 * Contact harvesting helpers (server-only) — pull a plausible email/phone out
 * of raw page text. Shared by the find-contact route and the research route
 * as the last-resort fallback after Hunter.
 */

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const PHONE_RE = /\+?\d[\d\s().-]{7,}\d/g;
const EMAIL_NOISE = /(no-?reply|example\.|sentry|\.png|\.jpg|\.svg|@2x|wixpress|godaddy)/i;
const DATE_LIKE = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/; // 2025-09-23 etc.

function looksLikePhone(raw: string): boolean {
  const p = raw.trim();
  if (DATE_LIKE.test(p)) return false;
  const digits = p.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 15) return false;
  // Require phone-ish formatting (+, parens, spaces) or a longer run of digits.
  return /[+()\s]/.test(p) || digits.length >= 10;
}

export function harvestFromText(
  text: string,
  domain: string
): { email: string | null; phone: string | null } {
  const emails = Array.from(new Set(text.match(EMAIL_RE) ?? []))
    .map((e) => e.toLowerCase())
    .filter((e) => !EMAIL_NOISE.test(e));
  // Prefer an email on the company's own domain.
  const onDomain = emails.find((e) => domain && e.endsWith(`@${domain}`));
  const email = onDomain || emails[0] || null;
  const phone = (text.match(PHONE_RE) ?? [])
    .map((p) => p.trim())
    .find(looksLikePhone);
  return { email, phone: phone ?? null };
}

/** Strip protocol/www/path from a website value to get the bare domain. */
export function toDomain(website?: string | null): string {
  return (website ?? "")
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/\/.*$/, "")
    .trim();
}
