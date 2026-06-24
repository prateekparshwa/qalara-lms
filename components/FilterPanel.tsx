"use client";

import { ChevronDown, Check } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";

export interface Filters {
  country: string;
  buyer_type: string;
  classification: string;
  am: string;
  org_scale: string;
  /** "yes" → only leads with no Account Manager (blank or "No Active AM"). */
  unassigned: string;
  /** "yes" → only buyers with a confirmed Sources-From-India. */
  india: string;
}

interface FilterOptions {
  countries: string[];
  buyerTypes: string[];
  classifications: string[];
  ams: string[];
  orgScales?: string[];
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
  formatOption,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  dot: string;
  /** Optional display transform — the underlying value stays unchanged (used
   * for filtering); only the visible text changes (e.g. "Large/ENT" → "Large"). */
  formatOption?: (v: string) => string;
}) {
  const fmt = (v: string) => (formatOption ? formatOption(v) : v);
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !listRef.current?.contains(e.target as Node)
      ) {
        close();
      }
    };
    const escHandler = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", escHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", escHandler);
    };
  }, [open, close]);

  const toggle = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUp(spaceBelow < 240);
    }
    setOpen((v) => !v);
  };

  const select = (opt: string) => {
    onChange(opt);
    close();
  };

  const display = value || "All";

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
      <button
        ref={triggerRef}
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full flex items-center justify-between text-xs font-sans border border-zinc-200 rounded px-3 py-2 bg-white text-editorial-text cursor-pointer hover:border-zinc-300 focus:outline-none focus:border-editorial-black transition-colors"
      >
        <span className={value ? "text-editorial-black" : "text-editorial-muted"}>{display}</span>
        <ChevronDown size={12} className={`text-editorial-muted flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          className={`absolute left-0 right-0 z-50 bg-white border border-zinc-200 rounded shadow-lg overflow-y-auto max-h-56 ${openUp ? "bottom-full mb-1" : "top-full mt-1"}`}
        >
          <button
            role="option"
            aria-selected={value === ""}
            onClick={() => select("")}
            className="w-full text-left px-3 py-2 text-xs font-sans hover:bg-zinc-50 flex items-center justify-between cursor-pointer"
          >
            <span className={value === "" ? "text-editorial-black font-medium" : "text-editorial-muted"}>All</span>
            {value === "" && <Check size={11} className="text-editorial-accent" />}
          </button>
          {options.map((opt) => (
            <button
              key={opt}
              role="option"
              aria-selected={value === opt}
              onClick={() => select(opt)}
              className="w-full text-left px-3 py-2 text-xs font-sans hover:bg-zinc-50 flex items-center justify-between cursor-pointer border-t border-zinc-50"
            >
              <span className={value === opt ? "text-editorial-black font-medium" : "text-editorial-text"}>{opt}</span>
              {value === opt && <Check size={11} className="text-editorial-accent" />}
            </button>
          ))}
        </div>
      )}
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

  // Org-size tier shows in a fixed business order (largest → smallest), not
  // alphabetical. Any value not in the list falls to the end, order preserved.
  const ORG_SCALE_ORDER = [
    "Large/ENT",
    "Medium",
    "Small",
    "Micro",
    "Individual",
    "Not Available",
  ];
  const orgScaleOptions = [
    ...ORG_SCALE_ORDER.filter((v) => (options.orgScales ?? []).includes(v)),
    ...(options.orgScales ?? []).filter((v) => !ORG_SCALE_ORDER.includes(v)),
  ];

  const clearAll = () =>
    onChange({ country: "", buyer_type: "", classification: "", am: "", org_scale: "", unassigned: "", india: "" });

  return (
    <aside className="w-56 flex-shrink-0 border-r border-zinc-200 bg-[#F7F8FE] overflow-y-auto">
      {/* Section header — fixed height so its bottom divider lines up with the
          adjacent main panel's header divider. */}
      <div className="px-4 min-h-[45px] flex items-center justify-between border-b border-zinc-300">
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

      <div className="px-4 py-5">
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
          {filters.org_scale && (
            <span className="filter-chip chip-amber">
              {filters.org_scale}
              <button onClick={() => clear("org_scale")} aria-label={`Remove org size filter ${filters.org_scale}`}>×</button>
            </span>
          )}
          {filters.unassigned === "yes" && (
            <span className="filter-chip chip-violet">
              Unassigned
              <button onClick={() => clear("unassigned")} aria-label="Remove Unassigned filter">×</button>
            </span>
          )}
          {filters.india === "yes" && (
            <span className="filter-chip chip-teal">
              Sources From India
              <button onClick={() => clear("india")} aria-label="Remove Sources From India filter">×</button>
            </span>
          )}
        </div>
      )}

      {/* Filter selects */}
      <div className="space-y-4">
        <FilterSelect
          label="Buyer Purchase Potential (AI Recommended)"
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
          onChange={(v) =>
            // Choosing a specific AM and "Unassigned only" are mutually
            // exclusive — picking one clears the other.
            onChange({ ...filters, am: v, unassigned: v ? "" : filters.unassigned })
          }
        />

        {/* Unassigned only — leads with no Account Manager yet */}
        <label className="flex items-center justify-between gap-2 cursor-pointer select-none">
          <span className="flex items-center gap-1.5 text-xs font-sans font-medium text-editorial-secondary">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: "#7C3AED" }}
              aria-hidden="true"
            />
            Show Unassigned AM Leads
          </span>
          <input
            type="checkbox"
            checked={filters.unassigned === "yes"}
            onChange={(e) =>
              onChange({
                ...filters,
                unassigned: e.target.checked ? "yes" : "",
                am: e.target.checked ? "" : filters.am,
              })
            }
            className="w-3.5 h-3.5 rounded border-zinc-300 accent-[#7C3AED] cursor-pointer flex-shrink-0"
          />
        </label>

        <FilterSelect
          label="Country"
          dot="#4F46E5"
          value={filters.country}
          options={options.countries}
          onChange={(v) => onChange({ ...filters, country: v })}
        />
        <FilterSelect
          label="Buyer Business Type"
          dot="#0D9488"
          value={filters.buyer_type}
          options={options.buyerTypes}
          onChange={(v) => onChange({ ...filters, buyer_type: v })}
        />
        <FilterSelect
          label="Buyer Org Size Tier"
          dot="#B45309"
          value={filters.org_scale}
          options={orgScaleOptions}
          onChange={(v) => onChange({ ...filters, org_scale: v })}
        />

        {/* Sources From India? — confirmed-Yes toggle */}
        <label className="flex items-center justify-between gap-2 cursor-pointer select-none">
          <span className="flex items-center gap-1.5 text-xs font-sans font-medium text-editorial-secondary">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: "#0D9488" }}
              aria-hidden="true"
            />
            Sources From India?
          </span>
          <input
            type="checkbox"
            checked={filters.india === "yes"}
            onChange={(e) =>
              onChange({ ...filters, india: e.target.checked ? "yes" : "" })
            }
            className="w-3.5 h-3.5 rounded border-zinc-300 accent-[#0D9488] cursor-pointer flex-shrink-0"
          />
        </label>
      </div>
      </div>
    </aside>
  );
}
