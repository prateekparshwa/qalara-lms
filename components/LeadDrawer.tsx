"use client";

import { useEffect, useRef } from "react";
import { X, ExternalLink, Mail, Phone, Globe } from "lucide-react";
import type { Lead } from "@/lib/leads";
import EnrichPanel from "./EnrichPanel";
import Badge from "./Badge";

interface LeadDrawerProps {
  lead: Lead | null;
  onClose: () => void;
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  if (!value || value.trim() === "" || value === "null") return null;
  return (
    <div className="py-2.5 border-b border-zinc-100 last:border-0">
      <div className="text-[9px] font-code font-bold uppercase tracking-widest text-editorial-muted mb-0.5">
        {label}
      </div>
      <div
        className={`text-sm text-editorial-text leading-snug ${
          mono ? "font-code text-xs" : "font-sans"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function LinkField({
  label,
  href,
  display,
}: {
  label: string;
  href: string | null | undefined;
  display?: string;
}) {
  if (!href) return null;
  return (
    <div className="py-2.5 border-b border-zinc-100 last:border-0">
      <div className="text-[9px] font-code font-bold uppercase tracking-widest text-editorial-muted mb-0.5">
        {label}
      </div>
      <a
        href={href.startsWith("http") ? href : `https://${href}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-blue-600 hover:underline flex items-center gap-1 font-sans"
      >
        {display ?? href}
        <ExternalLink size={11} />
      </a>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mt-6 mb-1">
      <div className="text-[10px] font-code font-bold uppercase tracking-widest text-editorial-black">
        {title}
      </div>
      <div className="rule mt-1" />
    </div>
  );
}

export default function LeadDrawer({ lead, onClose }: LeadDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Move focus into the drawer on open; restore it to the trigger on close.
  useEffect(() => {
    if (!lead) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    // Focus the panel itself so screen readers announce the dialog.
    panelRef.current?.focus();
    const trigger = restoreFocusRef.current;
    return () => {
      // Restore focus to the row that opened the drawer.
      trigger?.focus?.();
    };
  }, [lead]);

  if (!lead) return null;

  // Trap Tab focus within the drawer panel.
  const handleTrap = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;
    const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables || focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === panelRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      {/* Overlay */}
      <div className="drawer-overlay" onClick={onClose} />

      {/* Panel */}
      <div
        ref={panelRef}
        className="drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`${lead.organization ?? "Lead"} profile`}
        tabIndex={-1}
        onKeyDown={handleTrap}
      >
        {/* Drawer header */}
        <div className="sticky top-0 bg-white z-10 px-6 pt-5 pb-4 border-b border-zinc-200">
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-4">
              <h2 className="font-code font-bold text-lg text-editorial-black leading-tight">
                {lead.organization ?? "Unnamed Org"}
              </h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {lead.country && (
                  <span className="text-xs font-sans text-editorial-muted">
                    {lead.country}
                  </span>
                )}
                {lead.buyer_classification && (
                  <Badge value={lead.buyer_classification} kind="priority" />
                )}
                {lead.website_confidence && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-code text-editorial-muted">
                    web: <Badge value={lead.website_confidence} kind="web" />
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-zinc-100 transition-colors cursor-pointer flex-shrink-0"
              aria-label="Close"
            >
              <X size={16} className="text-editorial-muted" />
            </button>
          </div>

          {/* Quick contact row */}
          <div className="flex items-center gap-4 mt-3 flex-wrap">
            {lead.email && (
              <a
                href={`mailto:${lead.email}`}
                className="flex items-center gap-1 text-xs text-editorial-secondary hover:text-editorial-black font-sans"
              >
                <Mail size={11} />
                {lead.email}
              </a>
            )}
            {lead.phone && (
              <span className="flex items-center gap-1 text-xs text-editorial-secondary font-sans">
                <Phone size={11} />
                {lead.phone}
              </span>
            )}
            {lead.website && (
              <a
                href={lead.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-blue-600 hover:underline font-sans"
              >
                <Globe size={11} />
                {lead.website.replace(/^https?:\/\/(www\.)?/, "").slice(0, 32)}
              </a>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="px-6">
          {/* Contact */}
          <SectionHeader title="Contact" />
          <Field label="Full Name" value={lead.full_name} />
          <Field label="Designation" value={lead.designation} />
          <Field label="Source" value={lead.source} />

          {/* Company */}
          <SectionHeader title="Company" />
          <Field label="Address" value={lead.address} />
          <Field label="Buyer Type" value={lead.buyer_type} />
          <Field label="Categories" value={lead.categories} />
          <Field label="Employee Size" value={lead.employee_size} />
          <Field label="Org Scale" value={lead.org_scale} />
          <Field label="Price Points" value={lead.price_points} />
          <Field label="Store Count" value={lead.store_count} />

          {/* Market Intelligence */}
          <SectionHeader title="Market Intelligence" />
          <Field label="Brand Description" value={lead.brand_description} />
          <Field label="Materials Dealt" value={lead.materials_dealt} />
          <Field label="Customers & Markets" value={lead.customers_and_markets} />
          <Field label="Revenue / Turnover" value={lead.revenue_turnover} />
          <Field label="Competitors" value={lead.competitors} />
          <Field label="Target Audience" value={lead.target_audience} />
          <Field label="Import Countries" value={lead.import_countries} />
          <Field label="Imports From India" value={lead.imports_from_india} />

          {/* Social */}
          <SectionHeader title="Social" />
          <LinkField label="LinkedIn" href={lead.linkedin_url} />
          <Field label="LinkedIn Followers" value={lead.linkedin_followers} mono />
          <Field
            label="Instagram"
            value={
              lead.instagram_handle
                ? `@${lead.instagram_handle.replace("@", "")}`
                : null
            }
          />
          <Field label="Instagram Followers" value={lead.instagram_followers} mono />
          <Field label="Social Activity" value={lead.social_media_activity} />

          {/* Engagement */}
          <SectionHeader title="Engagement" />
          <Field label="First Contact" value={lead.first_contact_date} mono />
          <Field label="Last Contact (Buyer)" value={lead.last_contact_date} mono />
          <Field label="Account Manager" value={lead.current_am} />
          <Field label="Last Qalara Contact" value={lead.last_qalara_contact} mono />
          <Field label="Last Email Subject" value={lead.last_email_subject} />
          <Field label="Email Summary" value={lead.email_contact_summary} />

          {/* Engagement Metrics */}
          <SectionHeader title="Engagement Metrics" />
          <div className="grid grid-cols-2 gap-x-6 py-2">
            <div>
              <div className="text-[9px] font-code font-bold uppercase tracking-widest text-editorial-muted mb-2">
                Sourcing@qalara
              </div>
              <div className="space-y-1 text-xs font-sans text-editorial-secondary">
                {lead.sourcing_emails_low && <div>≤2 emails: {lead.sourcing_emails_low}</div>}
                {lead.sourcing_emails_mid && <div>3–7 emails: {lead.sourcing_emails_mid}</div>}
                {lead.sourcing_emails_high && <div>8+ emails: {lead.sourcing_emails_high}</div>}
                {lead.quotations_request && <div>Quotations: {lead.quotations_request}</div>}
                {lead.samples_request && <div>Samples: {lead.samples_request}</div>}
              </div>
            </div>
            <div>
              <div className="text-[9px] font-code font-bold uppercase tracking-widest text-editorial-muted mb-2">
                Buyers@qalara
              </div>
              <div className="space-y-1 text-xs font-sans text-editorial-secondary">
                {lead.buyers_emails_low && <div>≤2 emails: {lead.buyers_emails_low}</div>}
                {lead.buyers_emails_mid && <div>3–7 emails: {lead.buyers_emails_mid}</div>}
                {lead.buyers_emails_high && <div>8+ emails: {lead.buyers_emails_high}</div>}
                {lead.quotations && <div>Quotations: {lead.quotations}</div>}
                {lead.samples && <div>Samples: {lead.samples}</div>}
              </div>
            </div>
          </div>
        </div>

        {/* Live Intelligence */}
        <EnrichPanel lead={lead} />

        <div className="h-8" />
      </div>
    </>
  );
}
