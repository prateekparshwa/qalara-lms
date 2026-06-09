"use client";

import { useEffect, useRef } from "react";
import { X, Mail, Phone, Globe, FileDown } from "lucide-react";
import type { Lead } from "@/lib/leads";
import EnrichPanel from "./EnrichPanel";
import Badge from "./Badge";
import LeadDossier from "./LeadDossier";
import { downloadLeadPdf } from "@/lib/leadPdf";

interface LeadDrawerProps {
  lead: Lead | null;
  onClose: () => void;
}

function clean(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = v.trim();
  return s === "" || s.toLowerCase() === "null" ? null : s;
}

export default function LeadDrawer({ lead, onClose }: LeadDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!lead) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const trigger = restoreFocusRef.current;
    return () => {
      trigger?.focus?.();
    };
  }, [lead]);

  if (!lead) return null;

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

  const website = clean(lead.website);

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />

      <div
        ref={panelRef}
        className="drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`${lead.organization ?? "Lead"} profile`}
        tabIndex={-1}
        onKeyDown={handleTrap}
      >
        <div
          className="h-1 w-full sticky top-0 z-20"
          style={{
            background:
              "linear-gradient(90deg, #4F46E5 0%, #7C3AED 30%, #0D9488 60%, #F59E0B 82%, #E11D48 100%)",
          }}
          aria-hidden="true"
        />

        <div className="sticky top-1 bg-white z-10 px-6 pt-4 pb-4 border-b border-editorial-black">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="font-sans font-semibold text-2xl text-editorial-black leading-tight text-balance">
                {clean(lead.organization) ?? "Unnamed organization"}
              </h2>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {clean(lead.country) && (
                  <span className="text-xs font-sans text-editorial-secondary">
                    {lead.country}
                  </span>
                )}
                <Badge value={lead.buyer_classification} kind="priority" />
                <span className="inline-flex items-center gap-1 text-[10px] font-code text-editorial-muted">
                  web <Badge value={lead.website_confidence} kind="web" />
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => downloadLeadPdf(lead)}
                className="flex items-center gap-1 px-2 py-1.5 rounded text-xs font-sans text-editorial-secondary hover:bg-zinc-100 transition-colors cursor-pointer"
                aria-label="Download profile as PDF"
                title="Download PDF"
              >
                <FileDown size={14} />
                PDF
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded hover:bg-zinc-100 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X size={18} className="text-editorial-secondary" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-3 flex-wrap">
            {clean(lead.email) && (
              <a
                href={`mailto:${lead.email}`}
                className="flex items-center gap-1.5 text-xs text-editorial-accent hover:underline font-sans"
              >
                <Mail size={12} />
                {lead.email}
              </a>
            )}
            {clean(lead.phone) && (
              <span className="flex items-center gap-1.5 text-xs text-editorial-secondary font-sans">
                <Phone size={12} />
                {lead.phone}
              </span>
            )}
            {website && (
              <a
                href={website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-sans"
              >
                <Globe size={12} />
                {website.replace(/^https?:\/\/(www\.)?/, "").slice(0, 32)}
              </a>
            )}
          </div>
        </div>

        <div className="px-6">
          <LeadDossier lead={lead} />
        </div>

        <EnrichPanel lead={lead} />

        <div className="h-8" />
      </div>
    </>
  );
}
