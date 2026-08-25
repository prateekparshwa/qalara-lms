"use client";

import { useEffect, useRef, useState } from "react";
import { X, Mail, Phone, Globe, FileDown, Info, UserCheck, Lock, Briefcase } from "lucide-react";
import type { Lead } from "@/lib/leads";
import { webHint } from "@/lib/glossary";
import EnrichPanel from "./EnrichPanel";
import NotesPanel from "./NotesPanel";
import Badge from "./Badge";
import LeadDossier, { dossierSections } from "./LeadDossier";
import Moodboard from "./Moodboard";
import { downloadLeadPdf } from "@/lib/leadPdf";
import { primaryEmail as pickPrimaryEmail } from "@/lib/format";
import CountryFlag from "./CountryFlag";

interface LeadDrawerProps {
  lead: Lead | null;
  onClose: () => void;
  /** Known account managers for the assign dropdown. */
  amOptions?: string[];
  /** Called when the user assigns an AM; resolves when saved. */
  onAssignAm?: (lead: Lead, am: string) => Promise<void>;
  /** Called to release a dashboard-locked AM back to the sheet's control. */
  onReleaseAm?: (lead: Lead) => Promise<void>;
  /** Called to release a HubSpot-locked email back to the sheet's control. */
  onReleaseHubspotEmail?: (lead: Lead) => Promise<void>;
  /** Notified after AM notes are saved, so the host can patch its lead state. */
  onNotesSaved?: (
    id: number,
    notes: string | null,
    updatedAt: string | null,
    updatedBy: string | null
  ) => void;
}

function clean(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = v.trim();
  return s === "" || s.toLowerCase() === "null" ? null : s;
}

export default function LeadDrawer({
  lead,
  onClose,
  amOptions = [],
  onAssignAm,
  onReleaseAm,
  onReleaseHubspotEmail,
  onNotesSaved,
}: LeadDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);
  const [isReleasingEmail, setIsReleasingEmail] = useState(false);
  // Notes collapse state — open by default only when the buyer already has a note.
  const [notesOpen, setNotesOpen] = useState(false);
  useEffect(() => {
    setNotesOpen(!!clean(lead?.notes));
  }, [lead?.id, lead?.notes]);

  const handleAssign = async (am: string) => {
    if (!lead || !onAssignAm || !am || am === (lead.current_am ?? "")) return;
    setIsAssigning(true);
    try {
      await onAssignAm(lead, am);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleRelease = async () => {
    if (!lead || !onReleaseAm) return;
    setIsReleasing(true);
    try {
      await onReleaseAm(lead);
    } finally {
      setIsReleasing(false);
    }
  };

  const handleReleaseHubspotEmail = async () => {
    if (!lead || !onReleaseHubspotEmail) return;
    setIsReleasingEmail(true);
    try {
      await onReleaseHubspotEmail(lead);
    } finally {
      setIsReleasingEmail(false);
    }
  };

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

  // One email for the compact header — shared logic with the table column.
  const primaryEmail = pickPrimaryEmail(lead.email, lead.full_name);

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      {/* Moving amber boundary around the dossier panel */}
      <div className="amber-ring drawer-ring" aria-hidden="true" />

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

        <div className="sticky top-1 bg-[#fffaf2] z-10 px-6 pt-4 pb-4 border-b border-editorial-black relative overflow-hidden">
          {/* Radar sweep (teal) — decorative, behind the header content */}
          <div
            className="atlas-sweep pointer-events-none absolute z-0 hidden sm:block"
            style={{ top: "-200px", right: "-110px", width: "360px", height: "360px" }}
            aria-hidden="true"
          />
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="font-sans font-semibold text-2xl text-editorial-black leading-tight text-balance">
                {clean(lead.organization) ?? "Unnamed organization"}
              </h2>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {clean(lead.country) && (
                  <span className="text-xs font-sans text-editorial-secondary">
                    <CountryFlag country={lead.country} />
                    {lead.country}
                  </span>
                )}
                <Badge value={lead.buyer_classification} kind="priority" />
                {lead.customer_status && (
                  <Badge value={lead.customer_status} kind="customerStatus" />
                )}
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-sans text-editorial-muted cursor-help"
                  title={`Website Confidence — how sure we are that the website on file actually belongs to this buyer (AI-verified). ${webHint(lead.website_confidence)}`}
                >
                  Website Confidence{" "}
                  <Badge value={lead.website_confidence} kind="web" />
                  <Info size={11} className="text-editorial-muted" aria-hidden="true" />
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
            {primaryEmail && (
              // One email only, to keep the header compact — the buyer's own
              // address when it matches their name, otherwise the first on
              // file. The full list stays in the dossier's Basics section.
              <a
                href={`mailto:${primaryEmail}`}
                className="flex items-center gap-1.5 text-xs text-editorial-accent hover:underline font-sans"
              >
                <Mail size={12} />
                {primaryEmail}
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

          {/* Designation + Account Manager (Designation sits just left of AM) */}
          <div className="flex items-center gap-x-4 gap-y-2 mt-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Briefcase size={13} className="text-editorial-secondary flex-shrink-0" />
              <span className="text-xs font-sans text-editorial-secondary whitespace-nowrap">
                Designation
              </span>
              <span className="text-xs font-sans font-medium text-editorial-black">
                {clean(lead.designation) ?? "Publicly Not Available"}
              </span>
            </div>
            {/* Account Manager: editable for allow-listed users, read-only for everyone else */}
            <div className="flex items-center gap-2">
            <UserCheck size={13} className="text-editorial-secondary flex-shrink-0" />
            <span className="text-xs font-sans text-editorial-secondary whitespace-nowrap">
              Account Manager
            </span>
            {onAssignAm ? (
              <>
                <select
                  id="assign-am"
                  aria-label="Assign an Account Manager"
                  value={lead.current_am ?? ""}
                  disabled={isAssigning}
                  onChange={(e) => handleAssign(e.target.value)}
                  className="text-xs font-sans border border-zinc-200 rounded px-2 py-1 bg-white text-editorial-text focus:outline-none focus:border-editorial-black cursor-pointer disabled:opacity-50 max-w-[220px]"
                >
                  <option value="" disabled>
                    Assign an AM…
                  </option>
                  {Array.from(
                    new Set(
                      [lead.current_am, ...amOptions].filter(
                        (v): v is string => !!v && v.trim() !== ""
                      )
                    )
                  ).map((am) => (
                    <option key={am} value={am}>
                      {am}
                    </option>
                  ))}
                </select>
                {isAssigning && (
                  <span className="text-[11px] font-sans text-editorial-muted">
                    Saving…
                  </span>
                )}
                {/* Lock state: a dashboard-set AM is protected from sheet sync */}
                {lead.am_locked && (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-sans font-medium text-violet-700 bg-violet-50 border border-violet-200 rounded px-1.5 py-0.5 whitespace-nowrap"
                    title="This AM was set in the dashboard and won't be overwritten by a sheet sync. Release it to let the sheet manage it again."
                  >
                    <Lock size={9} />
                    Locked
                  </span>
                )}
                {lead.am_locked && onReleaseAm && (
                  <button
                    onClick={handleRelease}
                    disabled={isReleasing}
                    className="text-[10px] font-sans text-editorial-accent hover:underline cursor-pointer disabled:opacity-50 whitespace-nowrap"
                    title="Let the next sync adopt the sheet's AM value for this lead"
                  >
                    {isReleasing ? "Releasing…" : "Release to sheet"}
                  </button>
                )}
              </>
            ) : (
              <span className="text-xs font-sans font-medium text-editorial-black">
                {clean(lead.current_am) ?? "No Active AM"}
              </span>
            )}
            </div>
            {/* HubSpot-pulled email: locked against the next Sheets sync, same as AM above */}
            {lead.hubspot_email_locked && (
              <div className="flex items-center gap-2">
                <Mail size={13} className="text-editorial-secondary flex-shrink-0" />
                <span className="text-xs font-sans text-editorial-secondary whitespace-nowrap">
                  Last Email
                </span>
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-sans font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5 whitespace-nowrap"
                  title="Pulled from HubSpot — won't be overwritten by a Sheets sync until released."
                >
                  <Lock size={9} />
                  HubSpot locked
                </span>
                {onReleaseHubspotEmail && (
                  <button
                    onClick={handleReleaseHubspotEmail}
                    disabled={isReleasingEmail}
                    className="text-[10px] font-sans text-editorial-accent hover:underline cursor-pointer disabled:opacity-50 whitespace-nowrap"
                    title="Let the next sync adopt the sheet's email value for this lead"
                  >
                    {isReleasingEmail ? "Releasing…" : "Release to sheet"}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Quick-nav: jump to a dossier section without scrolling blind */}
          {dossierSections(lead).length > 1 && (
            <nav
              aria-label="Profile sections"
              className="flex items-center gap-1.5 mt-3 flex-wrap"
            >
              {dossierSections(lead).map((s) => (
                <button
                  key={s.id}
                  onClick={() =>
                    document
                      .getElementById(s.id)
                      ?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                  className="px-2 py-0.5 text-[11px] font-sans rounded-full border border-zinc-200 text-editorial-secondary hover:border-editorial-black hover:text-editorial-black transition-colors cursor-pointer inline-flex items-center gap-1"
                >
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: s.color }}
                    aria-hidden="true"
                  />
                  {s.short}
                </button>
              ))}
              {/* Notes pill — opens the (collapsible) AM Notes panel and scrolls to it. */}
              <button
                onClick={() => {
                  setNotesOpen(true);
                  setTimeout(
                    () =>
                      document
                        .getElementById("dossier-notes")
                        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                    0
                  );
                }}
                className="px-2 py-0.5 text-[11px] font-sans rounded-full border border-zinc-200 text-editorial-secondary hover:border-editorial-black hover:text-editorial-black transition-colors cursor-pointer inline-flex items-center gap-1"
              >
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: "#0D9488" }}
                  aria-hidden="true"
                />
                AM Notes
              </button>
              {/* Moodboard tab — sits at the end (next to Metrics); jumps to
                  the Generate Brand Moodboard launcher. */}
              {clean(lead.website) && (
                <button
                  onClick={() =>
                    document
                      .getElementById("dossier-moodboard")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                  className="px-2 py-0.5 text-[11px] font-sans rounded-full border border-zinc-200 text-editorial-secondary hover:border-editorial-black hover:text-editorial-black transition-colors cursor-pointer inline-flex items-center gap-1"
                >
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: "#F59E0B" }}
                    aria-hidden="true"
                  />
                  Moodboard
                </button>
              )}
            </nav>
          )}
        </div>

        <div className="px-6">
          <LeadDossier lead={lead} scrollMtClass="scroll-mt-48" />
          <NotesPanel
            lead={lead}
            open={notesOpen}
            onToggleOpen={() => setNotesOpen((v) => !v)}
            scrollMtClass="scroll-mt-48"
            onSaved={onNotesSaved}
          />
          <Moodboard lead={lead} />
        </div>

        <EnrichPanel lead={lead} />

        <div className="h-8" />
      </div>
    </>
  );
}
