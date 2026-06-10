"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, RefreshCw, Download, X, ArrowLeft } from "lucide-react";

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
}

function SearchField({
  label,
  placeholder,
  value,
  dot,
  ph,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  dot: string;
  /** AA-safe placeholder color for this field. */
  ph: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex-1 min-w-0">
      <label className="flex items-center gap-1.5 text-xs font-sans font-medium text-editorial-secondary mb-1">
        <span
          className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: dot }}
          aria-hidden="true"
        />
        {label}
      </label>
      <div className="relative">
        <Search
          size={13}
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: dot }}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ ["--ph" as string]: ph }}
          className="search-input w-full pl-8 pr-8 py-2 text-sm font-sans text-editorial-black border border-zinc-200 rounded focus:outline-none focus:border-editorial-black focus-visible:ring-2 focus-visible:ring-editorial-accent bg-white transition-colors"
        />
        {value && (
          <button
            onClick={() => onChange("")}
            aria-label={`Clear ${label} search`}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-editorial-muted hover:text-editorial-black cursor-pointer"
          >
            <X size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function MagazineHeader({
  search,
  onSearchChange,
  onSync,
  onExport,
  totalLeads,
  isSyncing,
  segmentLabel,
  backHref,
}: MagazineHeaderProps) {
  const [showExportMenu, setShowExportMenu] = useState(false);

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
      {/* Top bar */}
      <div className="px-6 pt-5 pb-3">
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

      {/* Search fields */}
      <div className="px-6 py-3 flex flex-col gap-3 md:flex-row md:items-end">
        <SearchField
          label="Brand / Organization"
          placeholder="Enter Buyer Brand/Organization Name"
          value={search.org}
          dot="#4F46E5"
          ph="#A5B4FC"
          onChange={(v) => onSearchChange({ ...search, org: v })}
        />
        <SearchField
          label="Email ID"
          placeholder="Enter Buyer Email ID"
          value={search.email}
          dot="#0D9488"
          ph="#5EB5AB"
          onChange={(v) => onSearchChange({ ...search, email: v })}
        />
        <SearchField
          label="Website URL"
          placeholder="Enter Buyer Website URL"
          value={search.website}
          dot="#B45309"
          ph="#D9A441"
          onChange={(v) => onSearchChange({ ...search, website: v })}
        />
      </div>
    </header>
  );
}
