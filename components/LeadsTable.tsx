"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown, ExternalLink } from "lucide-react";
import type { Lead } from "@/lib/leads";
import Badge from "./Badge";
import Legend from "./Legend";
import { buyerTypeTag } from "@/lib/glossary";

const col = createColumnHelper<Lead>();

const columns = [
  col.accessor("organization", {
    header: "Organization",
    cell: (info) => (
      <span className="font-sans font-medium text-editorial-black text-sm truncate block max-w-[220px]">
        {info.getValue() ?? "—"}
      </span>
    ),
  }),
  col.accessor("email", {
    header: "Email",
    cell: (info) => (
      <span className="text-xs text-editorial-secondary font-sans truncate block max-w-[180px]">
        {info.getValue() ?? "—"}
      </span>
    ),
  }),
  col.accessor("website", {
    header: "Website",
    cell: (info) => {
      const v = info.getValue();
      if (!v) return <span className="text-editorial-muted text-xs">—</span>;
      return (
        <a
          href={v}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-sans max-w-[160px] truncate"
        >
          {v.replace(/^https?:\/\/(www\.)?/, "")}
          <ExternalLink size={10} className="flex-shrink-0" />
        </a>
      );
    },
  }),
  col.accessor("country", {
    header: "Country",
    cell: (info) => (
      <span className="text-xs font-sans text-editorial-secondary truncate block max-w-[120px]">
        {info.getValue() ?? "—"}
      </span>
    ),
  }),
  col.accessor("buyer_type", {
    header: "Type",
    cell: (info) => {
      const v = info.getValue();
      if (!v) return <span className="text-editorial-muted text-xs">—</span>;
      // Abbreviate long buyer types
      const short = v.includes("/")
        ? v
            .split("/")
            .map((s) => s.trim().split(" ")[0])
            .join(" / ")
        : v.split(" ").slice(0, 3).join(" ");
      return (
        <span className={`tag ${buyerTypeTag(v)}`} title={v}>
          {short}
        </span>
      );
    },
  }),
  col.accessor("buyer_classification", {
    header: "Priority",
    cell: (info) => <Badge value={info.getValue()} kind="priority" />,
  }),
  col.accessor("website_confidence", {
    header: "Web",
    cell: (info) => <Badge value={info.getValue()} kind="web" />,
  }),
  col.accessor("current_am", {
    header: "AM",
    cell: (info) => (
      <span className="text-xs font-sans text-editorial-muted truncate block max-w-[100px]">
        {info.getValue() ?? "—"}
      </span>
    ),
  }),
];

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
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualSorting: true,
    state: { sorting },
    onSortingChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(sorting) : updater;
      setSorting(next);
      if (next.length > 0) {
        onSortChange(next[0].id, next[0].desc ? "desc" : "asc");
      } else {
        onSortChange("organization", "asc");
      }
    },
  });

  const totalPages = Math.ceil(total / limit);
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse min-w-[900px]">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="border-b border-zinc-200">
              {table.getFlatHeaders().map((header) => (
                <th
                  key={header.id}
                  onClick={header.column.getToggleSortingHandler()}
                  className={`text-left px-4 py-3 text-[10px] font-code font-bold uppercase tracking-widest text-editorial-muted border-b border-zinc-200 whitespace-nowrap ${
                    header.column.getCanSort()
                      ? "cursor-pointer select-none hover:text-editorial-black"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-1">
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                    {header.column.getCanSort() && (
                      <span className="text-zinc-300">
                        {header.column.getIsSorted() === "asc" ? (
                          <ChevronUp size={10} className="text-editorial-black" />
                        ) : header.column.getIsSorted() === "desc" ? (
                          <ChevronDown size={10} className="text-editorial-black" />
                        ) : (
                          <ChevronsUpDown size={10} />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-zinc-100">
                  {columns.map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-3 bg-zinc-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-16">
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
                        className="mt-1 flex items-center gap-1.5 px-3 py-1.5 text-xs font-sans font-medium border border-editorial-black rounded hover:bg-editorial-black hover:text-white transition-colors duration-150 cursor-pointer"
                      >
                        Try again
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-16">
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
                        className="mt-1 px-3 py-1.5 text-xs font-sans font-medium border border-editorial-black rounded hover:bg-editorial-black hover:text-white transition-colors duration-150 cursor-pointer"
                      >
                        Clear search & filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row, i) => {
                const org = row.original.organization ?? "this lead";
                return (
                  <tr
                    key={row.id}
                    onClick={() => onRowClick(row.original)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onRowClick(row.original);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open profile for ${org}`}
                    className={`leads-row border-b border-zinc-100 ${
                      i % 2 === 0 ? "bg-white" : "bg-zinc-50/50"
                    }`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 align-middle">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
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
            {total === 0 ? "No results" : `${from}–${to} of ${total.toLocaleString()} leads`}
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
