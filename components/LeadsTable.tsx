"use client";

import { useState } from "react";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import type { Lead } from "@/lib/leads";
import Badge from "./Badge";
import Legend from "./Legend";
import { buyerTypeTag } from "@/lib/glossary";
import CountryFlag from "./CountryFlag";

type SortId =
  | "organization"
  | "email"
  | "website"
  | "country"
  | "buyer_type"
  | "buyer_classification"
  | "current_am";

const SORTS: { id: SortId; label: string }[] = [
  { id: "buyer_classification", label: "AI Classification" },
  { id: "organization", label: "Buyer Organization" },
  { id: "country", label: "Buyer Country" },
  { id: "buyer_type", label: "Business Type" },
  { id: "email", label: "Buyer Email" },
  { id: "website", label: "Brand Website" },
  { id: "current_am", label: "Account Manager" },
];

function shortType(v: string): string {
  return v.includes("/")
    ? v
        .split("/")
        .map((s) => s.trim().split(" ")[0])
        .join(" / ")
    : v.split(" ").slice(0, 3).join(" ");
}

interface LeadsTableProps {
  data: Lead[];
  total: number;
  page: number;
  limit: number;
  isLoading: boolean;
  error?: string | null;
  onRetry?: () => void;
  onClearAll?: () => void;
  onRowClick: (lead: Lead) => void;
  onPageChange: (page: number) => void;
  onSortChange: (sort: string, order: "asc" | "desc") => void;
}

export default function LeadsTable({
  data,
  total,
  page,
  limit,
  isLoading,
  error,
  onRetry,
  onClearAll,
  onRowClick,
  onPageChange,
  onSortChange,
}: LeadsTableProps) {
  const [sortId, setSortId] = useState<SortId>("buyer_classification");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const changeSort = (id: SortId, dir: "asc" | "desc") => {
    setSortId(id);
    setSortDir(dir);
    onSortChange(id, dir);
  };

  const totalPages = Math.ceil(total / limit);
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Sort toolbar — replaces the column-header grid */}
      <div className="flex items-center gap-3 px-6 py-2 border-b-2 border-editorial-black bg-white flex-shrink-0">
        <label
          htmlFor="lead-sort"
          className="text-xs font-sans text-editorial-secondary"
        >
          Sort by
        </label>
        <select
          id="lead-sort"
          value={sortId}
          onChange={(e) => changeSort(e.target.value as SortId, sortDir)}
          className="text-xs font-sans border border-zinc-200 rounded px-2 py-1.5 bg-white text-editorial-text focus:outline-none focus:border-editorial-black cursor-pointer"
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => changeSort(sortId, sortDir === "asc" ? "desc" : "asc")}
          aria-label={`Sort ${sortDir === "asc" ? "descending" : "ascending"}`}
          title={sortDir === "asc" ? "Ascending — click for descending" : "Descending — click for ascending"}
          className="flex items-center gap-1 px-2 py-1.5 text-xs font-sans border border-zinc-200 rounded text-editorial-secondary hover:border-zinc-400 transition-colors cursor-pointer"
        >
          {sortDir === "asc" ? (
            <ArrowUpAZ size={13} />
          ) : (
            <ArrowDownAZ size={13} />
          )}
        </button>
        <span className="ml-auto text-[11px] font-code text-editorial-muted whitespace-nowrap">
          {total === 0
            ? ""
            : `${from}–${to} of ${total.toLocaleString()}`}
        </span>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <ul aria-hidden="true">
            {Array.from({ length: 10 }).map((_, i) => (
              <li
                key={i}
                className="px-6 py-4 border-b border-editorial-border"
              >
                <div className="h-4 w-56 bg-zinc-100 rounded animate-pulse mb-2" />
                <div className="h-3 w-80 bg-zinc-100 rounded animate-pulse" />
              </li>
            ))}
          </ul>
        ) : error ? (
          <div className="px-4 py-16 flex flex-col items-center gap-3 text-center">
            <p className="text-sm font-sans text-editorial-text">
              Couldn&apos;t load leads.
            </p>
            <p className="text-xs font-sans text-editorial-muted max-w-sm">
              {error}
            </p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="mt-1 px-3 py-1.5 text-xs font-sans font-medium border border-editorial-black rounded hover:bg-editorial-black hover:text-white transition-colors cursor-pointer"
              >
                Try again
              </button>
            )}
          </div>
        ) : data.length === 0 ? (
          <div className="px-4 py-16 flex flex-col items-center gap-2 text-center">
            <p className="text-sm font-sans text-editorial-text">
              No leads match your search or filters.
            </p>
            <p className="text-xs font-sans text-editorial-muted max-w-sm">
              Try a different organization name, email, or website, or clear a
              filter to widen the results.
            </p>
            {onClearAll && (
              <button
                onClick={onClearAll}
                className="mt-1 px-3 py-1.5 text-xs font-sans font-medium border border-editorial-black rounded hover:bg-editorial-black hover:text-white transition-colors cursor-pointer"
              >
                Clear search &amp; filters
              </button>
            )}
          </div>
        ) : (
          <ul>
            {data.map((lead) => {
              const org = lead.organization ?? "Unnamed organization";
              const site = lead.website
                ? lead.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")
                : null;
              return (
                <li key={lead.id}>
                  <div
                    onClick={() => onRowClick(lead)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onRowClick(lead);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open profile for ${org}`}
                    className="group flex items-center gap-4 px-6 py-3.5 cursor-pointer border-b border-editorial-border bg-white transition-colors hover:bg-[#F5F7FF] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-editorial-accent"
                  >
                    {/* Headline + secondary line */}
                    <div className="flex-1 min-w-0">
                      <div className="font-sans font-semibold text-[15px] text-editorial-black leading-snug truncate group-hover:text-editorial-accent transition-colors">
                        {org}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs font-sans text-editorial-secondary min-w-0">
                        {lead.email && (
                          <span className="truncate max-w-[260px]">
                            {lead.email}
                          </span>
                        )}
                        {lead.email && site && (
                          <span className="text-editorial-border" aria-hidden="true">
                            ·
                          </span>
                        )}
                        {site && (
                          <a
                            href={lead.website!}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1 truncate max-w-[220px]"
                          >
                            {site}
                            <ExternalLink size={10} className="flex-shrink-0" />
                          </a>
                        )}
                        {!lead.email && !site && (
                          <span className="text-editorial-muted">
                            No contact on file
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right meta cluster */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {lead.country && (
                        <span className="text-xs font-sans text-editorial-secondary max-w-[150px] truncate hidden md:block">
                          <CountryFlag country={lead.country} />
                          {lead.country}
                        </span>
                      )}
                      {lead.buyer_type && (
                        <span
                          className={`tag ${buyerTypeTag(lead.buyer_type)} hidden lg:inline-flex`}
                          title={lead.buyer_type}
                        >
                          {shortType(lead.buyer_type)}
                        </span>
                      )}
                      <Badge value={lead.buyer_classification} kind="priority" />
                      {lead.current_am && (
                        <span className="text-xs font-sans text-editorial-muted max-w-[110px] truncate hidden xl:block">
                          {lead.current_am}
                        </span>
                      )}
                      <ChevronRight
                        size={15}
                        className="text-zinc-300 group-hover:text-editorial-accent transition-colors"
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Pagination */}
      <div className="border-t border-zinc-200 px-6 py-3 flex items-center justify-between bg-white flex-shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-xs font-sans text-editorial-muted">
            {total === 0
              ? "No results"
              : `${from}–${to} of ${total.toLocaleString()} leads`}
          </span>
          <Legend />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(1)}
            disabled={page === 1}
            aria-label="First page"
            className="px-2 py-1 text-xs font-sans border border-zinc-200 rounded hover:border-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            «
          </button>
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            aria-label="Previous page"
            className="px-2 py-1 text-xs font-sans border border-zinc-200 rounded hover:border-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            ‹
          </button>
          <span className="px-3 py-1 text-xs font-code text-editorial-black">
            {page} / {totalPages || 1}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Next page"
            className="px-2 py-1 text-xs font-sans border border-zinc-200 rounded hover:border-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            ›
          </button>
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={page >= totalPages}
            aria-label="Last page"
            className="px-2 py-1 text-xs font-sans border border-zinc-200 rounded hover:border-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            »
          </button>
        </div>
      </div>
    </div>
  );
}
