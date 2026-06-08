"use client";

import { useState } from "react";
import { Search, RefreshCw, Download, X } from "lucide-react";

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
}

function SearchField({
  label,
  placeholder,
  value,
  dot,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  dot: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex-1 min-w-0">
      <label className="flex items-center gap-1.5 text-[10px] font-code font-semibold uppercase tracking-widest text-editorial-muted mb-1">
        <span
          className="inline-block w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: dot }}
          aria-hidden="true"
        />
        {label}
      </label>
      <div className="relative">
        <Search
          size={13}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-editorial-muted pointer-events-none"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-8 pr-8 py-2 text-sm font-sans border border-zinc-200 rounded focus:outline-none focus:border-editorial-black focus-visible:ring-2 focus-visible:ring-editorial-accent placeholder:text-editorial-muted bg-zinc-50 focus:bg-white transition-colors"
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
          {/* Wordmark */}
          <div className="flex-shrink-0">
            <div className="flex items-baseline gap-2">
              <span className="font-code font-bold text-2xl tracking-tight text-editorial-black">
                QALARA
              </span>
              <span className="text-editorial-accent font-code font-bold text-2xl">·</span>
              <span className="font-code font-bold text-2xl tracking-widest text-editorial-black uppercase">
                LEADS
              </span>
            </div>
            <p className="text-xs text-editorial-muted font-sans mt-0.5 tracking-wide uppercase">
              {totalLeads.toLocaleString()} records in database
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={onSync}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-sans font-medium border border-zinc-300 rounded text-editorial-secondary hover:border-editorial-black transition-colors duration-150 disabled:opacity-50 cursor-pointer"
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
          placeholder="e.g. 2XL Home"
          value={search.org}
          dot="#4F46E5"
          onChange={(v) => onSearchChange({ ...search, org: v })}
        />
        <SearchField
          label="Email ID"
          placeholder="e.g. name@company.com"
          value={search.email}
          dot="#0D9488"
          onChange={(v) => onSearchChange({ ...search, email: v })}
        />
        <SearchField
          label="Website URL"
          placeholder="e.g. company.com"
          value={search.website}
          dot="#B45309"
          onChange={(v) => onSearchChange({ ...search, website: v })}
        />
      </div>
    </header>
  );
}
