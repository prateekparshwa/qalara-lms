"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Search, RefreshCw, Download, X, ArrowLeft, Loader2 } from "lucide-react";
import type { Lead } from "@/lib/leads";
import CountryFlag from "./CountryFlag";

export interface SearchState {
  org: string;
  email: string;
  website: string;
}

interface MagazineHeaderProps {
  search: SearchState;
  onSearchChange: (next: SearchState) => void;
  onSync: () => Promise<void>;
  onExport: (format: "csv" | "xlsx") => void;
  totalLeads: number;
  isSyncing: boolean;
  /** Segment name shown as the dateline title. */
  segmentLabel?: string;
  /** Back link target (the directory chooser). */
  backHref?: string;
  /** Segment key used to scope typeahead suggestions. */
  segment?: string;
  /** Enable the typeahead suggestion dropdown under the search box. */
  suggest?: boolean;
  /** Notified with the picked lead so the host can show its row instantly. */
  onPick?: (lead: Lead) => void;
}

type Scope = "org" | "email" | "website";

const SCOPES: { key: Scope; label: string; placeholder: string; dot: string }[] = [
  {
    key: "org",
    label: "Organization",
    placeholder: "Search by buyer brand or organization name",
    dot: "#4F46E5",
  },
  {
    key: "email",
    label: "Email",
    placeholder: "Search by buyer email ID",
    dot: "#0D9488",
  },
  {
    key: "website",
    label: "Website",
    placeholder: "Search by buyer website URL",
    dot: "#B45309",
  },
];

export default function MagazineHeader({
  search,
  onSearchChange,
  onSync,
  onExport,
  totalLeads,
  isSyncing,
  segmentLabel,
  backHref,
  segment,
  suggest = false,
  onPick,
}: MagazineHeaderProps) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [scope, setScope] = useState<Scope>("org");

  // Typeahead suggestions (org OR email match) shown beneath the search box.
  const [suggestions, setSuggestions] = useState<Lead[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const skipNextFetch = useRef(false);

  const active = SCOPES.find((s) => s.key === scope)!;
  const value = search[scope];

  const setQuery = (v: string) =>
    onSearchChange({ org: "", email: "", website: "", [scope]: v });

  const switchScope = (next: Scope) => {
    const current = search[scope];
    setScope(next);
    // Carry the typed text into the new scope so switching re-runs the search.
    onSearchChange({ org: "", email: "", website: "", [next]: current });
  };

  // Debounced fetch of suggestions as the user types (suggestions search BOTH
  // org and email, so it doesn't matter which scope tab is active).
  useEffect(() => {
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      return;
    }
    const term = value.trim();
    if (!suggest || term.length < 2) {
      setSuggestions([]);
      setLoadingSuggest(false);
      return;
    }
    let cancelled = false;
    setLoadingSuggest(true);
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: term });
        if (segment) params.set("segment", segment);
        const res = await fetch(`/api/leads/suggest?${params}`);
        const data = await res.json().catch(() => ({}));
        if (!cancelled) {
          setSuggestions(res.ok ? data.suggestions ?? [] : []);
          setShowSuggest(true);
          setActiveIdx(-1);
        }
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setLoadingSuggest(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [value, segment, suggest]);

  // Close the suggestion dropdown on outside click.
  useEffect(() => {
    if (!showSuggest) return;
    const handler = (e: MouseEvent) => {
      if (!searchBoxRef.current?.contains(e.target as Node)) {
        setShowSuggest(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showSuggest]);

  // Picking a suggestion fills the search box with that buyer (org name when
  // known, else the email), so the table narrows to that row — the user then
  // clicks the row to open the dossier.
  const pick = useCallback(
    (lead: Lead) => {
      const target: Scope = lead.organization ? "org" : "email";
      const text = lead.organization ?? lead.email ?? "";
      skipNextFetch.current = true; // don't re-open suggestions for this fill
      setScope(target);
      onSearchChange({ org: "", email: "", website: "", [target]: text });
      setShowSuggest(false);
      setSuggestions([]);
      setActiveIdx(-1);
      // We already hold the full row — let the host render it immediately
      // instead of waiting out the search debounce + refetch.
      onPick?.(lead);
    },
    [onSearchChange, onPick]
  );

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggest || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      pick(suggestions[activeIdx]);
    } else if (e.key === "Escape") {
      setShowSuggest(false);
    }
  };

  return (
    <header className="bg-white border-b border-zinc-200 sticky top-0 z-30">
      {/* Vibrant accent strip */}
      <div
        className="h-1 w-full"
        style={{
          background:
            "linear-gradient(90deg, #4F46E5 0%, #7C3AED 30%, #0D9488 60%, #F59E0B 82%, #E11D48 100%)",
        }}
        aria-hidden="true"
      />
      {/* Soft aurora wash — the same warm glow as the landing page, static */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(620px 240px at 36% 0%, rgba(245,158,11,0.16), transparent 70%), radial-gradient(520px 220px at 8% 0%, rgba(79,70,229,0.10), transparent 70%), radial-gradient(460px 200px at 72% 0%, rgba(13,148,136,0.09), transparent 70%), radial-gradient(380px 180px at 95% 8%, rgba(225,29,72,0.07), transparent 70%)",
        }}
      />
      {/* Top bar */}
      <div className="relative px-6 pt-5 pb-3">
        <div className="flex items-start justify-between gap-6">
          {/* Dateline: back link + segment title + count */}
          <div className="flex-shrink-0 min-w-0">
            {backHref && (
              <Link
                href={backHref}
                className="inline-flex items-center gap-1 text-[11px] font-code text-editorial-muted hover:text-editorial-black transition-colors mb-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-editorial-accent rounded-sm"
              >
                <ArrowLeft size={11} />
                Qalara Buyer Directory
              </Link>
            )}
            <div className="flex items-baseline gap-2.5">
              <h1 className="font-sans font-semibold text-2xl tracking-tight text-editorial-black truncate">
                {segmentLabel ?? "Leads"}
              </h1>
              <span className="font-code text-xs text-editorial-muted whitespace-nowrap">
                {totalLeads.toLocaleString()} records
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={onSync}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-sans font-medium border border-indigo-200 rounded text-editorial-accent hover:bg-indigo-50 hover:border-editorial-accent transition-colors duration-150 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={12} className={isSyncing ? "animate-spin" : ""} />
              {isSyncing ? "Syncing…" : "Sync"}
            </button>

            <div className="relative">
              <button
                onClick={() => setShowExportMenu((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-sans font-medium border border-zinc-800 rounded text-editorial-black hover:bg-editorial-black hover:text-white transition-colors duration-150 cursor-pointer"
              >
                <Download size={12} />
                Export
              </button>
              {showExportMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowExportMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 bg-white border border-zinc-200 shadow-lg rounded z-20 min-w-[120px]">
                    <button
                      onClick={() => {
                        onExport("csv");
                        setShowExportMenu(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-xs hover:bg-zinc-50 font-sans cursor-pointer"
                    >
                      Download CSV
                    </button>
                    <button
                      onClick={() => {
                        onExport("xlsx");
                        setShowExportMenu(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-xs hover:bg-zinc-50 font-sans cursor-pointer border-t border-zinc-100"
                    >
                      Download XLSX
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Ruled divider */}
      <div className="rule mx-6" />

      {/* Unified search: one box, a scope picker beside it */}
      <div className="relative px-6 py-3 flex items-center gap-2">
        <div
          role="group"
          aria-label="Search scope"
          className="flex items-center rounded border border-zinc-200 divide-x divide-zinc-200 overflow-hidden flex-shrink-0"
        >
          {SCOPES.map((s) => (
            <button
              key={s.key}
              onClick={() => switchScope(s.key)}
              aria-pressed={scope === s.key}
              className={`px-3 py-2 text-xs font-sans transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                scope === s.key
                  ? "bg-editorial-accent text-white"
                  : "bg-white text-editorial-secondary hover:bg-zinc-50"
              }`}
            >
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: s.dot }}
                aria-hidden="true"
              />
              {s.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-0" ref={searchBoxRef}>
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-editorial-muted"
          />
          <input
            type="text"
            value={value}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggest(true)}
            onKeyDown={onSearchKeyDown}
            placeholder={active.placeholder}
            aria-label={`Search by ${active.label}`}
            role="combobox"
            aria-expanded={showSuggest}
            aria-controls="search-suggestions"
            aria-autocomplete="list"
            autoComplete="off"
            style={{ ["--ph" as string]: "#71717A" }}
            className="search-input w-full pl-9 pr-8 py-2 text-sm font-sans text-editorial-black border border-zinc-200 rounded focus:outline-none focus:border-editorial-black focus-visible:ring-2 focus-visible:ring-editorial-accent bg-white transition-colors"
          />
          {(loadingSuggest || value) && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center">
              {loadingSuggest ? (
                <Loader2 size={13} className="animate-spin text-editorial-muted" />
              ) : (
                <button
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="text-editorial-muted hover:text-editorial-black cursor-pointer"
                >
                  <X size={13} />
                </button>
              )}
            </span>
          )}

          {/* Typeahead suggestions */}
          {showSuggest && suggest && value.trim().length >= 2 && (
            <div
              id="search-suggestions"
              role="listbox"
              className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-zinc-200 rounded-md shadow-lg overflow-hidden max-h-80 overflow-y-auto"
            >
              {suggestions.length === 0 && !loadingSuggest ? (
                <div className="px-3 py-3 text-xs font-sans text-editorial-muted">
                  No buyers match “{value.trim()}”.
                </div>
              ) : (
                suggestions.map((lead, i) => (
                  <button
                    key={lead.id}
                    role="option"
                    aria-selected={i === activeIdx}
                    onMouseEnter={() => setActiveIdx(i)}
                    onClick={() => pick(lead)}
                    className={`w-full text-left px-3 py-2 flex items-start gap-2 border-b border-zinc-50 last:border-0 cursor-pointer transition-colors ${
                      i === activeIdx ? "bg-indigo-50" : "hover:bg-zinc-50"
                    }`}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-sans font-semibold text-editorial-black truncate">
                        {lead.organization ?? "—"}
                      </span>
                      {lead.email && (
                        <span className="block text-[11px] font-sans text-editorial-secondary truncate">
                          {lead.email}
                        </span>
                      )}
                    </span>
                    {lead.country && (
                      <span className="text-[11px] font-sans text-editorial-muted whitespace-nowrap flex items-center">
                        <CountryFlag country={lead.country} />
                        {lead.country}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
