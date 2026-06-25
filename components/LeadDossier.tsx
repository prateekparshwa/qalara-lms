import { ExternalLink, Info } from "lucide-react";
import type { Lead } from "@/lib/leads";
import { relativeDate } from "@/lib/format";
import Badge from "./Badge";

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
            mono ? "font-code text-xs" : "font-sans text-justify"
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

/**
 * Parse a free-text social field like
 * "https://…/company/x (company) / https://…/in/y (Jane Doe)" into clickable
 * entries. The sheet appends the source name after each URL, which breaks the
 * link if rendered as one anchor — so each URL gets its own redirect icon.
 */
function parseLinkEntries(
  v: string
): { url: string; label: string | null }[] {
  const out: { url: string; label: string | null }[] = [];
  const re = /(https?:\/\/[^\s()]+)\s*(?:\(([^)]+)\))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(v)) !== null) {
    const url = m[1].replace(/[.,;]+$/, "");
    if (!out.some((e) => e.url === url)) {
      out.push({ url, label: m[2]?.trim() ?? null });
    }
  }
  return out;
}

/**
 * Append the source of a follower count in brackets, derived from the matching
 * URL field — e.g. "885 (company)" or "1088 (@bel_epok)". Values that already
 * carry a bracketed source pass through untouched.
 */
function withSourceTag(
  count: string | null | undefined,
  urlField: string | null
): string | null {
  const c = clean(count);
  if (!c) return null;
  if (/\(/.test(c) || !urlField) return c;
  const first = parseLinkEntries(urlField)[0];
  let label = first?.label ?? null;
  if (!label && first?.url) {
    const insta = first.url.match(/instagram\.com\/([^/?#]+)/i);
    const liCompany = first.url.match(/linkedin\.com\/company\/([^/?#]+)/i);
    const liPerson = first.url.match(/linkedin\.com\/in\//i);
    label = insta
      ? `@${insta[1]}`
      : liCompany
        ? "company"
        : liPerson
          ? "personal profile"
          : null;
  }
  return label ? `${c} (${label})` : c;
}

/** A field whose value may contain one or more URLs (each with a source tag). */
function LinksField({
  label,
  value,
  showAll = false,
}: {
  label: string;
  value: string | null | undefined;
  showAll?: boolean;
}) {
  const v = clean(value);
  if (!v) {
    return showAll ? <Field label={label} value={null} showAll /> : null;
  }
  const entries = parseLinkEntries(v);
  if (entries.length === 0) {
    return <Field label={label} value={v} showAll={showAll} />;
  }
  return (
    <div className="py-2 border-b border-zinc-200 last:border-0 break-inside-avoid">
      <div className="text-[10px] font-code font-semibold uppercase tracking-wide text-editorial-muted mb-0.5">
        {label}
      </div>
      <div className="space-y-1">
        {entries.map((e) => (
          <div key={e.url} className="text-sm font-sans break-all">
            <a
              href={e.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
            >
              {e.url}
              <ExternalLink size={11} className="flex-shrink-0" />
            </a>
            {e.label && (
              <span className="text-xs text-editorial-muted"> ({e.label})</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  color,
  id,
  scrollMtClass,
  hint,
}: {
  title: string;
  color: string;
  id: string;
  scrollMtClass: string;
  /** Optional tooltip explaining what this section measures. */
  hint?: string;
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
      {hint && (
        <span title={hint} className="cursor-help flex items-center">
          <Info size={12} className="text-editorial-muted" aria-label={hint} />
        </span>
      )}
      <span className="flex-1 border-t border-zinc-400" />
    </div>
  );
}

/**
 * Column AG arrives as "2026-06-11 (gunjan.kumari@qalara / sourcing@qalara)" —
 * date plus the sending inbox. Show "date · via <inbox>", preferring the
 * sourcing@/buyers@ inbox over a personal sender when both are listed.
 */
function formatQalaraContact(v: string | null | undefined): string | null {
  const s = clean(v);
  if (!s) return null;
  const m = s.match(/^([^(]*?)\s*\(([^)]+)\)\s*$/);
  if (!m) return s;
  const date = m[1].trim();
  const parts = m[2].split("/").map((p) => p.trim()).filter(Boolean);
  const inbox =
    parts.find((p) => /^(sourcing|buyers)@/i.test(p)) ?? parts[0] ?? null;
  return inbox ? `${date} · via ${inbox}` : date;
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

// Keyword lists used by the engagement scan to count Quotation / Sample intent
// in buyer emails — surfaced as info-icon tooltips on those rows.
const QUOTATION_KEYWORDS =
  "Unique sum count of keywords (price, rate, cost, quote, quote sheet, cost sheet) in email received from buyer";
const SAMPLE_KEYWORDS =
  "Unique sum count of keywords (product development, sample, design, specifications, specs, spec sheet, template, artwork, colour proof, colour, develop) in email received from buyer";

function MetricRow({
  label,
  value,
  info,
}: {
  label: string;
  value: string | null | undefined;
  /** Optional tooltip shown on an info icon beside the label (e.g. the keyword list). */
  info?: string;
}) {
  const v = clean(value);
  if (!v) return null;
  // Quotations / Samples carry the keyword(s) the buyer used. Bold the keyword
  // when it's a real signal (mirrors how EmailCountRow bolds a positive count);
  // a zero/none value stays quiet.
  const zeroish = /^(0|no|none|nil|n\/?a|-|false)$/i.test(v.trim());
  return (
    <div className="text-editorial-secondary">
      <span className="inline-flex items-center gap-1">
        {label}
        {info && (
          <span
            className="inline-flex text-editorial-muted cursor-help align-middle"
            title={info}
            aria-label={info}
          >
            <Info size={12} />
          </span>
        )}
      </span>
      :{" "}
      {zeroish ? (
        v
      ) : (
        <span className="font-bold text-editorial-black">{v}</span>
      )}
    </div>
  );
}

/**
 * Inbound-email counts live in three bucket columns (≤2 / 3–7 / 8+); a buyer's
 * count sits in the bucket its total falls into. Show a SINGLE line with the
 * matching bucket and the total count of emails received — always, irrespective
 * of whether any emails were received (a zero buyer reads "≤2 emails: 0").
 */
function EmailCountRow({
  low,
  mid,
  high,
}: {
  low: string | null | undefined;
  mid: string | null | undefined;
  high: string | null | undefined;
}) {
  const num = (v: string | null | undefined) => {
    const n = parseInt((clean(v) ?? "").replace(/[^\d]/g, ""), 10);
    return isNaN(n) ? 0 : n;
  };
  const total = num(low) + num(mid) + num(high);
  const bucket = total <= 2 ? "≤2 emails" : total <= 7 ? "3–7 emails" : "8+ emails";
  return (
    <div className={total > 0 ? "text-editorial-black" : "text-editorial-secondary"}>
      <span className={total > 0 ? "font-bold" : ""}>
        {bucket}: {total}
      </span>{" "}
      <span className="font-normal text-editorial-muted text-[11px]">
        [sum count of email(s) received from buyer]
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
  // Social sits directly below Basic Details.
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
    any(
      lead.first_contact_date,
      lead.last_contact_date,
      lead.current_am,
      lead.last_qalara_contact,
      lead.last_email_subject,
      lead.email_contact_summary,
      lead.email_snapshot
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
  // Buyer Purchase Potential arrives as "HIGH — rationale…"; split the tier
  // (shown as a badge) from the rationale text.
  const potentialRaw = clean(lead.buyer_classification);
  const potentialText = potentialRaw
    ? potentialRaw.replace(/^\s*(HIGH|MEDIUM|MED|LOW)\b\s*[—:-]*\s*/i, "").trim()
    : null;
  const sections = dossierSections(lead, showAll);
  const has = (id: string) => sections.some((s) => s.id === id);
  // Discovery renders the dossier full-width: two columns halve the scroll.
  // CSS columns (not grid) so each column packs tight — no row-height gaps.
  const cols = showAll ? "sm:columns-2 sm:gap-x-10" : "";

  return (
    <div>
      {(potentialRaw || showAll) && (
        <div className="mt-5">
          <div className="flex items-center gap-1.5 mb-2">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: "#4F46E5" }}
              aria-hidden="true"
            />
            <span
              className="text-[11px] font-code font-bold uppercase tracking-[0.18em]"
              style={{ color: "#4F46E5" }}
            >
              Buyer Purchase Potential
            </span>
          </div>
          {potentialRaw ? (
            <div className="flex items-start gap-2.5">
              <Badge value={lead.buyer_classification ?? null} kind="priority" />
              {potentialText && (
                <p className="flex-1 text-sm leading-relaxed font-sans text-editorial-secondary text-justify">
                  {potentialText}
                </p>
              )}
            </div>
          ) : (
            <div className="text-sm font-sans italic text-editorial-muted">
              Not Available
            </div>
          )}
        </div>
      )}

      {/* Divider line between Purchase Potential and Brand Description */}
      {potentialRaw && (standfirst || showAll) && (
        <div className="mt-5 border-t border-zinc-200" />
      )}

      {(standfirst || showAll) && (
        <div className="mt-5">
          <div className="text-[10px] font-code font-semibold uppercase tracking-wide text-editorial-muted mb-1">
            Brand Description
          </div>
          {standfirst ? (
            <p className="text-[15px] leading-relaxed font-sans text-editorial-secondary text-justify">
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

      {has("dossier-social") && (
        <>
          <SectionHeader
            id="dossier-social"
            scrollMtClass={scrollMtClass}
            title="Social Media"
            color="#7C3AED"
          />
          <div className={cols}>
            <LinksField showAll={showAll} label="LinkedIn URL of the Buyer" value={lead.linkedin_url} />
            <Field
              showAll={showAll}
              label="LinkedIn Followers"
              value={withSourceTag(lead.linkedin_followers, clean(lead.linkedin_url))}
              mono
            />
            {/^https?:\/\//i.test(clean(lead.instagram_handle) ?? "") ? (
              <LinksField
                showAll={showAll}
                label="Instagram Handle or FB Page of the Buyer/Org"
                value={lead.instagram_handle}
              />
            ) : (
              <Field
                showAll={showAll}
                label="Instagram Handle or FB Page of the Buyer/Org"
                value={
                  clean(lead.instagram_handle)
                    ? `@${lead.instagram_handle!.replace("@", "")}`
                    : null
                }
              />
            )}
            <Field
              showAll={showAll}
              label="Instagram Followers of the Buyer/Org Page"
              value={withSourceTag(
                lead.instagram_followers,
                clean(lead.instagram_handle)
              )}
              mono
            />
            <Field showAll={showAll} label="Social Media Activity of the Buyer" value={lead.social_media_activity} />
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

      {has("dossier-engagement") && (
        <>
          <SectionHeader
            id="dossier-engagement"
            scrollMtClass={scrollMtClass}
            title="Buyer Communication / Engagement"
            color="#E11D48"
          />
          <div className={cols}>
            <Field showAll={showAll} label="First Contact Date (By Buyer) · YYYY-MM-DD" value={lead.first_contact_date} mono relative />
            <Field showAll={showAll} label="Last Contact Date (By Buyer) · YYYY-MM-DD" value={lead.last_contact_date} mono relative />
            <Field showAll={showAll} label="Last Email Received from Buyer (Snapshot)" value={lead.email_snapshot} />
            <Field showAll={showAll} label="Current AM (Account Manager)" value={lead.current_am} />
            <Field
              showAll={showAll}
              label="Last Contact Date from Qalara to Buyer · YYYY-MM-DD"
              value={formatQalaraContact(lead.last_qalara_contact)}
              mono
              relative
            />
            <Field showAll={showAll} label="Last Email Subject to Buyer" value={lead.last_email_subject} />
            <Field showAll={showAll} label="Last Email Summary / Sales POC Notes" value={lead.email_contact_summary} />
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
            hint="Count of emails received from Buyers"
          />
          <div className="space-y-4 py-2">
            <div>
              <div className="text-[10px] font-code font-semibold uppercase tracking-wide text-editorial-muted mb-2">
                Sourcing@qalara
              </div>
              <div className="space-y-1 text-xs font-sans">
                <EmailCountRow
                  low={lead.sourcing_emails_low}
                  mid={lead.sourcing_emails_mid}
                  high={lead.sourcing_emails_high}
                />
                <MetricRow label="Quotations" value={lead.quotations_request} info={QUOTATION_KEYWORDS} />
                <MetricRow label="Samples" value={lead.samples_request} info={SAMPLE_KEYWORDS} />
              </div>
            </div>
            <div>
              <div className="text-[10px] font-code font-semibold uppercase tracking-wide text-editorial-muted mb-2">
                Buyers@qalara
              </div>
              <div className="space-y-1 text-xs font-sans">
                <EmailCountRow
                  low={lead.buyers_emails_low}
                  mid={lead.buyers_emails_mid}
                  high={lead.buyers_emails_high}
                />
                <MetricRow label="Quotations" value={lead.quotations} info={QUOTATION_KEYWORDS} />
                <MetricRow label="Samples" value={lead.samples} info={SAMPLE_KEYWORDS} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
