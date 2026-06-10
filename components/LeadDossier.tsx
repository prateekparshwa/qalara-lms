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

/** True if a metric value is a real signal (not empty, 0, no, n/a, -). */
function hasSignal(v: string | null | undefined): boolean {
  const s = clean(v);
  if (!s) return false;
  return !/^(0+|no|n\/a|na|-|none|nil)$/i.test(s);
}

function MetricRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!clean(value)) return null;
  return (
    <div
      className={
        hasSignal(value)
          ? "font-bold text-editorial-black"
          : "text-editorial-secondary"
      }
    >
      {label}: {value}
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
      {(standfirst || showAll) && (
        <div className="mt-5">
          <div className="text-[10px] font-code font-semibold uppercase tracking-wide text-editorial-muted mb-1">
            Brand Description
          </div>
          {standfirst ? (
            <p className="text-[15px] leading-relaxed font-sans text-editorial-secondary">
              {standfirst}
            </p>
          ) : (
            <div className="text-sm font-sans italic text-editorial-muted">
              Not Available
            </div>
          )}
        </div>
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
          <SectionHeader title="Buyer Basic Details" color="#4F46E5" />
          <Field showAll={showAll} label="Buyer Full Name" value={lead.full_name} />
          <Field showAll={showAll} label="Buyer Designation" value={lead.designation} />
          <Field showAll={showAll} label="Buyer Email ID(s)" value={lead.email} mono />
          <Field showAll={showAll} label="Buyer Phone #" value={lead.phone} mono />
          <Field showAll={showAll} label="Lead Source" value={lead.source} />
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
          lead.store_count,
          lead.materials_dealt,
          lead.customers_and_markets,
          lead.revenue_turnover,
          lead.competitors,
          lead.target_audience,
          lead.import_countries,
          lead.imports_from_india
        )) && (
        <>
          <SectionHeader title="Buyer Brand / Business Intelligence" color="#0D9488" />
          <Field showAll={showAll} label="Buyer Full Address" value={lead.address} />
          <Field showAll={showAll} label="Buyer Business Type" value={lead.buyer_type} />
          <Field showAll={showAll} label="Categories Buyer Deals In" value={lead.categories} />
          <Field showAll={showAll} label="No. of Employees in Buyer's Org" value={lead.employee_size} />
          <Field showAll={showAll} label="Buyer Org Size Tier" value={lead.org_scale} />
          <Field showAll={showAll} label="Retail Price Points" value={lead.price_points} />
          <Field showAll={showAll} label="Count of Stores of the Buyer" value={lead.store_count} />
          <Field showAll={showAll} label="Materials Dealt In" value={lead.materials_dealt} />
          <Field showAll={showAll} label="Customers & Markets Buyer Is Present In" value={lead.customers_and_markets} />
          <Field showAll={showAll} label="Potential Revenue / Turnover" value={lead.revenue_turnover} />
          <Field showAll={showAll} label="Competitors of the Buyer" value={lead.competitors} />
          <Field showAll={showAll} label="Target Audience of the Buyer" value={lead.target_audience} />
          <Field showAll={showAll} label="Sourcing Countries of the Buyer" value={lead.import_countries} />
          <Field showAll={showAll} label="Sources From India?" value={lead.imports_from_india} />
          <Field
            showAll={showAll}
            label="Website Confidence (AI-Verified)"
            value={lead.website_confidence}
          />
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
          <SectionHeader title="Social Media" color="#7C3AED" />
          <LinkField showAll={showAll} label="LinkedIn URL of the Buyer" href={lead.linkedin_url} />
          <Field showAll={showAll} label="LinkedIn Followers" value={lead.linkedin_followers} mono />
          <Field
            showAll={showAll}
            label="Instagram Handle or FB Page of the Buyer/Org"
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
          <Field showAll={showAll} label="Instagram Followers of the Buyer/Org Page" value={lead.instagram_followers} mono />
          <Field showAll={showAll} label="Social Media Activity of the Buyer" value={lead.social_media_activity} />
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
          <SectionHeader title="Buyer Communication / Engagement" color="#E11D48" />
          <Field showAll={showAll} label="First Contact Date (By Buyer)" value={lead.first_contact_date} mono />
          <Field showAll={showAll} label="Last Contact Date (By Buyer)" value={lead.last_contact_date} mono />
          <Field showAll={showAll} label="Current AM (Account Manager)" value={lead.current_am} />
          <Field showAll={showAll} label="Last Contact Date from Qalara to Buyer" value={lead.last_qalara_contact} mono />
          <Field showAll={showAll} label="Last Email Subject to Buyer" value={lead.last_email_subject} />
          <Field showAll={showAll} label="Email Summary (Qalara to Buyer)" value={lead.email_contact_summary} />
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
              <div className="space-y-1 text-xs font-sans">
                <MetricRow label="≤2 emails" value={lead.sourcing_emails_low} />
                <MetricRow label="3–7 emails" value={lead.sourcing_emails_mid} />
                <MetricRow label="8+ emails" value={lead.sourcing_emails_high} />
                <MetricRow label="Quotations" value={lead.quotations_request} />
                <MetricRow label="Samples" value={lead.samples_request} />
              </div>
            </div>
            <div>
              <div className="text-[10px] font-code font-semibold uppercase tracking-wide text-editorial-muted mb-2">
                Buyers@qalara
              </div>
              <div className="space-y-1 text-xs font-sans">
                <MetricRow label="≤2 emails" value={lead.buyers_emails_low} />
                <MetricRow label="3–7 emails" value={lead.buyers_emails_mid} />
                <MetricRow label="8+ emails" value={lead.buyers_emails_high} />
                <MetricRow label="Quotations" value={lead.quotations} />
                <MetricRow label="Samples" value={lead.samples} />
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
