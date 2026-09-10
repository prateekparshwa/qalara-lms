/**
 * Deep link to a contact's record in HubSpot. Needs the portal id and UI
 * domain (they vary by region — this account is eu1); both are non-secret
 * account identifiers, kept in env rather than hardcoded.
 *
 *   NEXT_PUBLIC_HUBSPOT_PORTAL_ID   e.g. 24910540
 *   NEXT_PUBLIC_HUBSPOT_UI_DOMAIN   e.g. app-eu1.hubspot.com (default app.hubspot.com)
 */
export function hubspotContactUrl(contactId: string | null | undefined): string | null {
  const id = (contactId ?? "").trim();
  const portal = (process.env.NEXT_PUBLIC_HUBSPOT_PORTAL_ID ?? "").trim();
  if (!id || !portal) return null;
  const domain = (process.env.NEXT_PUBLIC_HUBSPOT_UI_DOMAIN ?? "app.hubspot.com").trim();
  return `https://${domain}/contacts/${portal}/record/0-1/${id}`;
}
