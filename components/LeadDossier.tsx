import { ExternalLink } from "lucide-react";
import type { Lead } from "@/lib/leads";

/**
 * The shared "dossier" body — standfirst + all grouped field sections.
 * Used by both the lead profile drawer and the General Discovery result, so a
 * researched buyer reads exactly like a known one. Fields with no value hide
 * themselves; a section with no populated fields collapses entirely.
 */

function clean(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = String(v).trim();
  return s === "" || s.toLowerCase() === "null" ? null : s;
}

function Field({
  label,
  value,
  mono = false,
  showAll = false,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  showAll?: boolean;
}) {
  const v = clean(value);
  if (!v && !showAll) return null;
  return (
    <div className="py-2 border-b border-zinc-100 last:border-0">
      <div className="text-[10px] font-code font-semibold uppercase tracking-wide text-editorial-muted mb-0.5">
        {label}
      </div>
      {v ? (
        <div
          className={`text-sm text-editorial-text leading-relaxed break-words ${
            mono ? "font-code text-xs" : "font-sans"
          }`}
        >
          {v}
        </div>
      ) : (
        <div className="text-sm font-sans italic text-editorial-muted">
          Not Available
        </div>
      )}
    </div>
  );
}

function LinkField({
  label,
  href,
  showAll = false,
}: {
  label: string;
  href: string | null | undefined;
  showAll?: boolean;
}) {
  const h = clean(href);
  if (!h) {
    return showAll ? <Field label={label} value={null} showAll /> : null;
  }
  return (
    <div className="py-2 border-b border-zinc-100 last:border-0">
      <div className="text-[10px] font-code font-semibold uppercase tracking-wide text-editorial-muted mb-0.5">
        {label}
      </div>
      <a
        href={h.startsWith("http") ? h : `https://${h}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1 font-sans break-words"
      >
        {h}
        <ExternalLink size={11} className="flex-shrink-0" />
      </a>
    </div>
  );
}

function SectionHeader({ title, color }: { title: string; color: string }) {
  return (
    <div className="mt-7 mb-2 flex items-center gap-2">
      <span
        className="inline-block w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <span
        className="text-xs font-code font-bold uppercase tracking-widest"
        style={{ color }}
      >
        {title}
      </span>
      <span className="flex-1 border-t border-editorial-border" />
    </div>
  );
}

/** True if any of the given values is non-empty. */
function any(...vals: (string | null | undefined)[]): boolean {
  return vals.some((v) => clean(v) !== null);
}

export default function LeadDossier({
  lead,
  showAll = false,
}: {
  lead: Partial<Lead>;
  showAll?: boolean;
}) {
  const standfirst = clean(lead.brand_description);
  const hasMetrics = any(
    lead.sourcing_emails_low,
    lead.sourcing_emails_mid,
    lead.sourcing_emails_high,
    lead.quotations_request,
    lead.samples_request,
    lead.buyers_emails_low,
    lead.buyers_emails_mid,
    lead.buyers_emails_high,
    lead.quotations,
    lead.samples
  );

  return (
    <div>
      {standfirst && (
        <p className="mt-5 text-[15px] leading-relaxed font-sans text-editorial-secondary">
          {standfirst}
        </p>
      )}

      {(showAll ||
        any(
          lead.full_name,
          lead.designation,
          lead.email,
          lead.phone,
          lead.source
        )) && (
        <>
          <SectionHeader title="Contact" color="#4F46E5" />
          <Field showAll={showAll} label="Full Name" value={lead.full_name} />
          <Field showAll={showAll} label="Designation" value={lead.designation} />
          <Field showAll={showAll} label="Email ID" value={lead.email} mono />
          <Field showAll={showAll} label="Phone No" value={lead.phone} mono />
          <Field showAll={showAll} label="Source" value={lead.source} />
        </>
      )}

      {(showAll ||
        any(
          lead.address,
          lead.buyer_type,
          lead.categories,
          lead.employee_size,
          lead.org_scale,
          lead.price_points,
          lead.store_count
        )) && (
        <>
          <SectionHeader title="Company" color="#0D9488" />
          <Field showAll={showAll} label="Address" value={lead.address} />
          <Field showAll={showAll} label="Buyer Type" value={lead.buyer_type} />
          <Field showAll={showAll} label="Categories" value={lead.categories} />
          <Field showAll={showAll} label="Employee Size" value={lead.employee_size} />
          <Field showAll={showAll} label="Org Scale" value={lead.org_scale} />
          <Field showAll={showAll} label="Price Points" value={lead.price_points} />
          <Field showAll={showAll} label="Store Count" value={lead.store_count} />
        </>
      )}

      {(showAll ||
        any(
          lead.materials_dealt,
          lead.customers_and_markets,
          lead.revenue_turnover,
          lead.competitors,
          lead.target_audience,
          lead.import_countries,
          lead.imports_from_india
        )) && (
        <>
          <SectionHeader title="Market Intelligence" color="#B45309" />
          <Field showAll={showAll} label="Materials Dealt" value={lead.materials_dealt} />
          <Field showAll={showAll} label="Customers & Markets" value={lead.customers_and_markets} />
          <Field showAll={showAll} label="Revenue / Turnover" value={lead.revenue_turnover} />
          <Field showAll={showAll} label="Competitors" value={lead.competitors} />
          <Field showAll={showAll} label="Target Audience" value={lead.target_audience} />
          <Field showAll={showAll} label="Import Countries" value={lead.import_countries} />
          <Field showAll={showAll} label="Imports From India" value={lead.imports_from_india} />
        </>
      )}

      {(showAll ||
        any(
          lead.linkedin_url,
          lead.linkedin_followers,
          lead.instagram_handle,
          lead.instagram_followers,
          lead.social_media_activity
        )) && (
        <>
          <SectionHeader title="Social" color="#7C3AED" />
          <LinkField showAll={showAll} label="LinkedIn" href={lead.linkedin_url} />
          <Field showAll={showAll} label="LinkedIn Followers" value={lead.linkedin_followers} mono />
          <Field
            showAll={showAll}
            label="IG/FB Account"
            value={
              clean(lead.instagram_handle)
                ? /^https?:\/\/|facebook\.com|fb\.com/i.test(
                    lead.instagram_handle!
                  )
                  ? lead.instagram_handle
                  : `@${lead.instagram_handle!.replace("@", "")}`
                : null
            }
          />
          <Field showAll={showAll} label="Instagram Followers" value={lead.instagram_followers} mono />
          <Field showAll={showAll} label="Social Activity" value={lead.social_media_activity} />
        </>
      )}

      {any(
        lead.first_contact_date,
        lead.last_contact_date,
        lead.current_am,
        lead.last_qalara_contact,
        lead.last_email_subject,
        lead.email_contact_summary
      ) && (
        <>
          <SectionHeader title="Engagement" color="#E11D48" />
          <Field showAll={showAll} label="First Contact" value={lead.first_contact_date} mono />
          <Field showAll={showAll} label="Last Contact (Buyer)" value={lead.last_contact_date} mono />
          <Field showAll={showAll} label="Account Manager" value={lead.current_am} />
          <Field showAll={showAll} label="Last Qalara Contact" value={lead.last_qalara_contact} mono />
          <Field showAll={showAll} label="Last Email Subject" value={lead.last_email_subject} />
          <Field showAll={showAll} label="Email Summary" value={lead.email_contact_summary} />
        </>
      )}

      {hasMetrics && (
        <>
          <SectionHeader title="Engagement Metrics" color="#4F46E5" />
          <div className="grid grid-cols-2 gap-x-6 py-2">
            <div>
              <div className="text-[10px] font-code font-semibold uppercase tracking-wide text-editorial-muted mb-2">
                Sourcing@qalara
              </div>
              <div className="space-y-1 text-xs font-sans text-editorial-secondary">
                {clean(lead.sourcing_emails_low) && (
                  <div>≤2 emails: {lead.sourcing_emails_low}</div>
                )}
                {clean(lead.sourcing_emails_mid) && (
                  <div>3–7 emails: {lead.sourcing_emails_mid}</div>
                )}
                {clean(lead.sourcing_emails_high) && (
                  <div>8+ emails: {lead.sourcing_emails_high}</div>
                )}
                {clean(lead.quotations_request) && (
                  <div>Quotations: {lead.quotations_request}</div>
                )}
                {clean(lead.samples_request) && (
                  <div>Samples: {lead.samples_request}</div>
                )}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-code font-semibold uppercase tracking-wide text-editorial-muted mb-2">
                Buyers@qalara
              </div>
              <div className="space-y-1 text-xs font-sans text-editorial-secondary">
                {clean(lead.buyers_emails_low) && (
                  <div>≤2 emails: {lead.buyers_emails_low}</div>
                )}
                {clean(lead.buyers_emails_mid) && (
                  <div>3–7 emails: {lead.buyers_emails_mid}</div>
                )}
                {clean(lead.buyers_emails_high) && (
                  <div>8+ emails: {lead.buyers_emails_high}</div>
                )}
                {clean(lead.quotations) && <div>Quotations: {lead.quotations}</div>}
                {clean(lead.samples) && <div>Samples: {lead.samples}</div>}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
