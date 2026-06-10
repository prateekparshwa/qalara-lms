"use client";

import { X, ChevronDown } from "lucide-react";
import { useState } from "react";

export interface Filters {
  country: string;
  buyer_type: string;
  classification: string;
  am: string;
  confidence: string;
}

interface FilterOptions {
  countries: string[];
  buyerTypes: string[];
  classifications: string[];
  ams: string[];
}

interface FilterPanelProps {
  filters: Filters;
  options: FilterOptions;
  onChange: (filters: Filters) => void;
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
  dot,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  dot: string;
}) {
  return (
    <div className="relative">
      <label className="flex items-center gap-1.5 text-xs font-sans font-medium text-editorial-secondary mb-1.5">
        <span
          className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: dot }}
          aria-hidden="true"
        />
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none text-xs font-sans border border-zinc-200 rounded px-3 py-2 pr-8 focus:outline-none focus:border-editorial-black bg-white text-editorial-text cursor-pointer"
        >
          <option value="">All</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <ChevronDown
          size={12}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-editorial-muted pointer-events-none"
        />
      </div>
    </div>
  );
}

export default function FilterPanel({
  filters,
  options,
  onChange,
}: FilterPanelProps) {
  const activeCount = Object.values(filters).filter(Boolean).length;

  const clear = (key: keyof Filters) =>
    onChange({ ...filters, [key]: "" });

  const clearAll = () =>
    onChange({ country: "", buyer_type: "", classification: "", am: "", confidence: "" });

  const confidenceOptions = ["HIGH", "MEDIUM", "LOW"];

  return (
    <aside className="w-56 flex-shrink-0 border-r border-zinc-200 bg-[#F7F8FE] px-4 py-5 overflow-y-auto">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-code font-bold uppercase tracking-widest text-editorial-black">
          Filters
        </span>
        {activeCount > 0 && (
          <button
            onClick={clearAll}
            className="text-[10px] font-sans text-editorial-accent hover:underline cursor-pointer"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="rule mb-4" />

      {/* Active chips */}
      {activeCount > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {filters.country && (
            <span className="filter-chip chip-indigo">
              {filters.country}
              <button onClick={() => clear("country")} aria-label={`Remove country filter ${filters.country}`}>×</button>
            </span>
          )}
          {filters.buyer_type && (
            <span className="filter-chip chip-teal">
              {filters.buyer_type.length > 16
                ? filters.buyer_type.slice(0, 16) + "…"
                : filters.buyer_type}
              <button onClick={() => clear("buyer_type")} aria-label="Remove buyer type filter">×</button>
            </span>
          )}
          {filters.classification && (
            <span className="filter-chip chip-rose">
              {filters.classification}
              <button onClick={() => clear("classification")} aria-label={`Remove classification filter ${filters.classification}`}>×</button>
            </span>
          )}
          {filters.am && (
            <span className="filter-chip chip-violet">
              {filters.am.length > 16 ? filters.am.slice(0, 16) + "…" : filters.am}
              <button onClick={() => clear("am")} aria-label="Remove account manager filter">×</button>
            </span>
          )}
          {filters.confidence && (
            <span className="filter-chip chip-amber">
              {filters.confidence}
              <button onClick={() => clear("confidence")} aria-label={`Remove confidence filter ${filters.confidence}`}>×</button>
            </span>
          )}
        </div>
      )}

      {/* Filter selects */}
      <div className="space-y-4">
        <FilterSelect
          label="Country"
          dot="#4F46E5"
          value={filters.country}
          options={options.countries}
          onChange={(v) => onChange({ ...filters, country: v })}
        />
        <FilterSelect
          label="Buyer Type"
          dot="#0D9488"
          value={filters.buyer_type}
          options={options.buyerTypes}
          onChange={(v) => onChange({ ...filters, buyer_type: v })}
        />
        <FilterSelect
          label="AI Classification"
          dot="#E11D48"
          value={filters.classification}
          options={options.classifications}
          onChange={(v) => onChange({ ...filters, classification: v })}
        />
        <FilterSelect
          label="Account Manager"
          dot="#7C3AED"
          value={filters.am}
          options={options.ams}
          onChange={(v) => onChange({ ...filters, am: v })}
        />
        <FilterSelect
          label="Web Confidence"
          dot="#B45309"
          value={filters.confidence}
          options={confidenceOptions}
          onChange={(v) => onChange({ ...filters, confidence: v })}
        />
      </div>
    </aside>
  );
}
