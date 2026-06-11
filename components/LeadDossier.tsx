import { ExternalLink } from "lucide-react";
import type { Lead } from "@/lib/leads";
import { relativeDate } from "@/lib/format";

/**
 * The shared "dossier" body — standfirst + all grouped field sections.
 * Used by both the lead profile drawer and the General Discovery result, so a
 * researched buyer reads exactly like a known one. Fields with no value hide
 * themselves; a section with no populated fields collapses entirely.
 *
 * Each section carries a stable id so a quick-nav strip (rendered by the
 * host: drawer header or Discovery page) can jump to it; use
 * `dossierSections()` to know which sections will render for a given lead.
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
  relative = false,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  showAll?: boolean;
  /** Append a "· 3 mo ago" hint when the value parses as a date. */
  relative?: boolean;
}) {
  const v = clean(value);
  if (!v && !showAll) return null;
  const rel = relative && v ? relativeDate(v) : null;
  return (
    <div className="py-2 border-b border-zinc-200 last:border-0 break-inside-avoid">
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
          {rel && (
            <span className="font-sans text-xs text-editorial-muted">
              {" "}
              · {rel}
            </span>
          )}
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
    <div className="py-2 border-b border-zinc-200 last:border-0 break-inside-avoid">
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

function SectionHeader({
  title,
  color,
  id,
  scrollMtClass,
}: {
  title: string;
  color: string;
  id: string;
  scrollMtClass: string;
}) {
  return (
    <div id={id} className={`mt-7 mb-2 flex items-center gap-2 ${scrollMtClass}`}>
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
      <span className="flex-1 border-t border-zinc-400" />
    </div>
  );
}

/** True if any of the given values is non-empty. */
function any(...vals: (string | null | undefined)[]): boolean {
  return vals.some((v) => clean(v) !== null);
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
    <div className="text-editorial-secondary">
      {label}:{" "}
      <span
        className={
          hasSignal(value) ? "font-bold text-editorial-black" : undefined
        }
      >
        {value}
      </span>
    </div>
  );
}

export interface DossierSection {
  id: string;
  title: string;
  /** Short label for the quick-nav strip. */
  short: string;
  color: string;
}

/** Which dossier sections will render for this lead (drives the quick-nav). */
export function dossierSections(
  lead: Partial<Lead>,
  showAll = false
): DossierSection[] {
  const out: DossierSection[] = [];
  if (
    showAll ||
    any(lead.full_name, lead.designation, lead.email, lead.phone, lead.source)
  ) {
    out.push({
      id: "dossier-basic",
      title: "Buyer Basic Details",
      short: "Basics",
      color: "#4F46E5",
    });
  }
  if (
    showAll ||
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
      lead.imports_from_india,
      lead.website_confidence
    )
  ) {
    out.push({
      id: "dossier-business",
      title: "Buyer Brand / Business Intelligence",
      short: "Business",
      color: "#0D9488",
    });
  }
  if (
    showAll ||
    any(
      lead.linkedin_url,
      lead.linkedin_followers,
      lead.instagram_handle,
      lead.instagram_followers,
      lead.social_media_activity
    )
  ) {
    out.push({
      id: "dossier-social",
      title: "Social Media",
      short: "Social",
      color: "#7C3AED",
    });
  }
  if (
    any(
      lead.first_contact_date,
      lead.last_contact_date,
      lead.current_am,
      lead.last_qalara_contact,
      lead.last_email_subject,
      lead.email_contact_summary
    )
  ) {
    out.push({
      id: "dossier-engagement",
      title: "Buyer Communication / Engagement",
      short: "Engagement",
      color: "#E11D48",
    });
  }
  if (
    any(
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
    )
  ) {
    out.push({
      id: "dossier-metrics",
      title: "Engagement Metrics",
      short: "Metrics",
      color: "#4F46E5",
    });
  }
  return out;
}

export default function LeadDossier({
  lead,
  showAll = false,
  /** Anchor offset so jumped-to sections clear the host's sticky chrome. */
  scrollMtClass = "scroll-mt-44",
}: {
  lead: Partial<Lead>;
  showAll?: boolean;
  scrollMtClass?: string;
}) {
  const standfirst = clean(lead.brand_description);
  const sections = dossierSections(lead, showAll);
  const has = (id: string) => sections.some((s) => s.id === id);
  // Discovery renders the dossier full-width: two columns halve the scroll.
  // CSS columns (not grid) so each column packs tight — no row-height gaps.
  const cols = showAll ? "sm:columns-2 sm:gap-x-10" : "";

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

      {has("dossier-basic") && (
        <>
          <SectionHeader
            id="dossier-basic"
            scrollMtClass={scrollMtClass}
            title="Buyer Basic Details"
            color="#4F46E5"
          />
          <div className={cols}>
            <Field showAll={showAll} label="Buyer Full Name" value={lead.full_name} />
            <Field showAll={showAll} label="Buyer Designation" value={lead.designation} />
            <Field showAll={showAll} label="Buyer Email ID(s)" value={lead.email} mono />
            <Field showAll={showAll} label="Buyer Phone #" value={lead.phone} mono />
            <Field showAll={showAll} label="Lead Source" value={lead.source} />
          </div>
        </>
      )}

      {has("dossier-business") && (
        <>
          <SectionHeader
            id="dossier-business"
            scrollMtClass={scrollMtClass}
            title="Buyer Brand / Business Intelligence"
            color="#0D9488"
          />
          <div className={cols}>
            <Field showAll={showAll} label="Buyer Full Address" value={lead.address} />
            <Field showAll={showAll} label="Buyer Business Type" value={lead.buyer_type} />
            <Field showAll={showAll} label="Categories Buyer Deals In" value={lead.categories} />
            <Field showAll={showAll} label="No. of Employees in Buyer's Org" value={lead.employee_size} />
            <Field showAll={showAll} label="Buyer Org Size Tier" value={lead.org_scale} />
            <Field showAll={showAll} label="Retail Price Points" value={lead.price_points} />
            <Field showAll={showAll} label="No. of Stores of the Buyer" value={lead.store_count} />
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
          </div>
        </>
      )}

      {has("dossier-social") && (
        <>
          <SectionHeader
            id="dossier-social"
            scrollMtClass={scrollMtClass}
            title="Social Media"
            color="#7C3AED"
          />
          <div className={cols}>
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
          </div>
        </>
      )}

      {has("dossier-engagement") && (
        <>
          <SectionHeader
            id="dossier-engagement"
            scrollMtClass={scrollMtClass}
            title="Buyer Communication / Engagement"
            color="#E11D48"
          />
          <div className={cols}>
            <Field showAll={showAll} label="First Contact Date (By Buyer)" value={lead.first_contact_date} mono relative />
            <Field showAll={showAll} label="Last Contact Date (By Buyer)" value={lead.last_contact_date} mono relative />
            <Field showAll={showAll} label="Current AM (Account Manager)" value={lead.current_am} />
            <Field showAll={showAll} label="Last Contact Date from Qalara to Buyer" value={lead.last_qalara_contact} mono relative />
            <Field showAll={showAll} label="Last Email Subject to Buyer" value={lead.last_email_subject} />
            <Field showAll={showAll} label="Email Summary (Qalara to Buyer)" value={lead.email_contact_summary} />
          </div>
        </>
      )}

      {has("dossier-metrics") && (
        <>
          <SectionHeader
            id="dossier-metrics"
            scrollMtClass={scrollMtClass}
            title="Engagement Metrics"
            color="#4F46E5"
          />
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
