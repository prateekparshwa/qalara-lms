/**
 * Hard-coded allowlist for who may reassign Account Managers.
 *
 * IMPORTANT — this is a SOFT UI gate, not a hard security boundary. The portal
 * authenticates everyone with a single shared Basic-Auth login (see
 * middleware.ts), so there is no real per-user identity. The user self-
 * identifies by entering their email (kept in localStorage) and we check it
 * against this list to decide whether to show the AM-assignment control. It
 * hides the feature from everyone else, but anyone who knows an allowed address
 * could still type it. Good enough for an internal tool; replace with real
 * per-user auth (SSO) if a hard boundary is ever required.
 */
/**
 * Allowlist of AM editors, sourced from NEXT_PUBLIC_AM_EDITORS (a comma-
 * separated list of emails) so the addresses aren't hardcoded in the public
 * repo. Read client-side, so it must be a NEXT_PUBLIC_ var (inlined at build).
 * Empty when unset — then nobody gets the AM-edit control.
 */
export const AM_EDITORS: readonly string[] = (
  process.env.NEXT_PUBLIC_AM_EDITORS ?? ""
)
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const USER_EMAIL_STORAGE_KEY = "qalara_user_email";

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

/** True only for the hard-coded AM editors. */
export function canEditAm(email: string | null | undefined): boolean {
  return (AM_EDITORS as readonly string[]).includes(normalizeEmail(email));
}

export function getStoredEmail(): string {
  if (typeof window === "undefined") return "";
  try {
    return normalizeEmail(window.localStorage.getItem(USER_EMAIL_STORAGE_KEY));
  } catch {
    return "";
  }
}

export function setStoredEmail(email: string): void {
  if (typeof window === "undefined") return;
  try {
    const e = normalizeEmail(email);
    if (e) window.localStorage.setItem(USER_EMAIL_STORAGE_KEY, e);
    else window.localStorage.removeItem(USER_EMAIL_STORAGE_KEY);
  } catch {
    /* localStorage unavailable — treat as no identity */
  }
}
