"use client";

import { useState } from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ExternalLink,
} from "lucide-react";
import type { Lead } from "@/lib/leads";
import Badge from "./Badge";
import Legend from "./Legend";
import { buyerTypeTag } from "@/lib/glossary";
import { primaryEmail } from "@/lib/format";
import CountryFlag from "./CountryFlag";

type ColId =
  | "organization"
  | "email"
  | "website"
  | "country"
  | "buyer_type"
  | "buyer_classification"
  | "current_am";

const COLUMNS: { id: ColId; label: string; dot: string; sortable: boolean }[] = [
  { id: "organization", label: "Buyer Organization", dot: "#4F46E5", sortable: true },
  { id: "email", label: "Buyer Email ID", dot: "#0D9488", sortable: true },
  { id: "website", label: "Brand Website", dot: "#B45309", sortable: true },
  { id: "country", label: "Buyer Country", dot: "#7C3AED", sortable: true },
  { id: "buyer_type", label: "Business Type", dot: "#E11D48", sortable: true },
  { id: "buyer_classification", label: "Buyer Purchase Potential (AI Recommended)", dot: "#4F46E5", sortable: true },
  { id: "current_am", label: "Account Manager", dot: "#7C3AED", sortable: true },
];

function shortType(v: string): string {
  return v.includes("/")
    ? v
        .split("/")
        .map((s) => s.trim().split(" ")[0])
        .join(" / ")
    : v.split(" ").slice(0, 3).join(" ");
}

function Cell({ lead, col }: { lead: Lead; col: ColId }) {
  switch (col) {
    case "organization":
      return (
        <span className="font-sans font-semibold text-sm text-editorial-black group-hover:text-editorial-accent transition-colors block max-w-[200px] break-words">
          {lead.organization ?? "—"}
        </span>
      );
    case "email":
      // One email only — the buyer's own when it matches their name, else the
      // first on file. The full list stays in the dossier.
      return (
        <span className="text-xs font-sans text-editorial-secondary block max-w-[190px] break-words">
          {primaryEmail(lead.email, lead.full_name) ?? "—"}
        </span>
      );
    case "website": {
      const v = lead.website;
      if (!v) return <span className="text-editorial-muted text-xs">—</span>;
      return (
        <a
          href={v}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-xs text-blue-600 hover:text-blue-800 hover:underline inline-flex items-start gap-1 font-sans max-w-[160px] break-all"
        >
          {v.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
          <ExternalLink size={10} className="flex-shrink-0 mt-0.5" />
        </a>
      );
    }
    case "country":
      return (
        <span className="text-xs font-sans text-editorial-secondary block max-w-[140px] break-words">
          <CountryFlag country={lead.country} />
          {lead.country ?? "—"}
        </span>
      );
    case "buyer_type": {
      const v = lead.buyer_type;
      if (!v) return <span className="text-editorial-muted text-xs">—</span>;
      return (
        <span className={`tag ${buyerTypeTag(v)}`} title={v}>
          {shortType(v)}
        </span>
      );
    }
    case "buyer_classification":
      return <Badge value={lead.buyer_classification} kind="priority" />;
    case "current_am":
      return (
        <span className="text-xs font-sans text-editorial-secondary block max-w-[120px] break-words">
          {lead.current_am ?? "—"}
        </span>
      );
  }
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
  const [sortId, setSortId] = useState<ColId>("buyer_classification");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = (id: ColId) => {
    const nextDir: "asc" | "desc" =
      sortId === id && sortDir === "asc" ? "desc" : "asc";
    setSortId(id);
    setSortDir(nextDir);
    onSortChange(id, nextDir);
  };

  const totalPages = Math.ceil(total / limit);
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse min-w-[860px]">
          <thead className="sticky top-0 z-10">
            <tr style={{ backgroundColor: "#F5F7FF" }}>
              {COLUMNS.map((c) => {
                const active = sortId === c.id;
                return (
                  <th
                    key={c.id}
                    onClick={() => c.sortable && toggleSort(c.id)}
                    className={`text-left px-3 py-2.5 text-[11px] font-code font-semibold tracking-wide border-b-2 border-editorial-black align-middle ${
                      c.sortable
                        ? "cursor-pointer select-none hover:bg-indigo-100/60"
                        : ""
                    } ${active ? "text-editorial-black" : "text-editorial-secondary"}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: c.dot }}
                        aria-hidden="true"
                      />
                      <span className="leading-tight">{c.label}</span>
                      {c.sortable && (
                        <span className="ml-0.5">
                          {active ? (
                            sortDir === "asc" ? (
                              <ChevronUp size={11} className="text-editorial-accent" />
                            ) : (
                              <ChevronDown size={11} className="text-editorial-accent" />
                            )
                          ) : (
                            <ChevronsUpDown size={11} className="text-zinc-300" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className="border-b border-editorial-border">
                  {COLUMNS.map((c) => (
                    <td key={c.id} className="px-4 py-3">
                      <div className="h-3 bg-zinc-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-16">
                  <div className="flex flex-col items-center gap-3 text-center">
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
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-16">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <p className="text-sm font-sans text-editorial-text">
                      No leads match your search or filters.
                    </p>
                    <p className="text-xs font-sans text-editorial-muted max-w-sm">
                      Try a different organization name, email, or website, or
                      clear a filter to widen the results.
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
                </td>
              </tr>
            ) : (
              data.map((lead, i) => {
                const org = lead.organization ?? "this lead";
                return (
                  <tr
                    key={lead.id}
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
                    className={`group cursor-pointer border-b border-editorial-border transition-colors hover:bg-[#F5F7FF] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-editorial-accent ${
                      i % 2 === 1 ? "bg-zinc-50/40" : "bg-white"
                    }`}
                  >
                    {COLUMNS.map((c) => (
                      <td
                        key={c.id}
                        className={`px-3 py-2.5 align-top ${
                          c.id === "buyer_classification" ? "text-center" : ""
                        }`}
                      >
                        <Cell lead={lead} col={c.id} />
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
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
