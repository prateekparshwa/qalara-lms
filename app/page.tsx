"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import MagazineHeader from "@/components/MagazineHeader";
import StatsBar from "@/components/StatsBar";
import FilterPanel, { Filters } from "@/components/FilterPanel";
import LeadsTable from "@/components/LeadsTable";
import LeadDrawer from "@/components/LeadDrawer";
import Toast, { ToastState, ToastType } from "@/components/Toast";
import type { Lead } from "@/lib/leads";

interface Stats {
  total: number;
  verified: number;
  highConfidence: number;
  highClassification: number;
}

interface FilterOptions {
  countries: string[];
  buyerTypes: string[];
  classifications: string[];
  ams: string[];
}

interface LeadsResponse {
  data: Lead[];
  total: number;
  page: number;
  limit: number;
}

const DEFAULT_STATS: Stats = {
  total: 0,
  verified: 0,
  highConfidence: 0,
  highClassification: 0,
};

const DEFAULT_FILTERS: Filters = {
  country: "",
  buyer_type: "",
  classification: "",
  am: "",
  confidence: "",
};

function useDebounce<T>(value: T, delay: number): T {
  const [dv, setDv] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDv(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return dv;
}

export default function Home() {
  const [stats, setStats] = useState<Stats>(DEFAULT_STATS);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    countries: [],
    buyerTypes: [],
    classifications: [],
    ams: [],
  });

  const [search, setSearch] = useState({ org: "", email: "", website: "" });
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("organization");
  const [order, setOrder] = useState<"asc" | "desc">("asc");

  const [leadsData, setLeadsData] = useState<LeadsResponse>({
    data: [],
    total: 0,
    page: 1,
    limit: 50,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [leadsError, setLeadsError] = useState<string | null>(null);

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const [toast, setToast] = useState<ToastState | null>(null);
  const toastKey = useRef(0);
  const showToast = useCallback((message: string, type: ToastType = "info") => {
    toastKey.current += 1;
    setToast({ message, type, key: toastKey.current });
  }, []);

  const debouncedSearch = useDebounce(search, 300);

  // Load stats + filter options (on mount, and again after an upload)
  const loadMeta = useCallback(() => {
    fetch("/api/leads/stats")
      .then((r) => {
        if (!r.ok) throw new Error("stats");
        return r.json();
      })
      .then(setStats)
      .catch(() => showToast("Couldn't load summary stats.", "error"));

    fetch("/api/leads/filter-options")
      .then((r) => {
        if (!r.ok) throw new Error("filter-options");
        return r.json();
      })
      .then(setFilterOptions)
      .catch(() => showToast("Couldn't load filter options.", "error"));
  }, [showToast]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  // Load leads whenever query/filters/page/sort change
  const fetchLeads = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "50",
        sort,
        order,
        ...(debouncedSearch.org && { org: debouncedSearch.org }),
        ...(debouncedSearch.email && { email: debouncedSearch.email }),
        ...(debouncedSearch.website && { website: debouncedSearch.website }),
        ...(filters.country && { country: filters.country }),
        ...(filters.buyer_type && { buyer_type: filters.buyer_type }),
        ...(filters.classification && { classification: filters.classification }),
        ...(filters.am && { am: filters.am }),
        ...(filters.confidence && { confidence: filters.confidence }),
      });
      const res = await fetch(`/api/leads?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      const data = await res.json();
      setLeadsData(data);
      setLeadsError(null);
    } catch (err) {
      setLeadsError(
        err instanceof Error
          ? err.message
          : "The leads service is unreachable. Check your connection and retry."
      );
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, filters, page, sort, order]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Reset to page 1 when search/filters change
  const prevQuery = useRef(JSON.stringify(debouncedSearch));
  const prevFilters = useRef(filters);
  useEffect(() => {
    const q = JSON.stringify(debouncedSearch);
    if (
      prevQuery.current !== q ||
      JSON.stringify(prevFilters.current) !== JSON.stringify(filters)
    ) {
      setPage(1);
    }
    prevQuery.current = q;
    prevFilters.current = filters;
  }, [debouncedSearch, filters]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/leads/sync", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Sync failed (${res.status})`);
      }
      showToast(
        data.message ||
          (typeof data.synced === "number"
            ? `Synced ${data.synced} leads.`
            : "Sync complete."),
        data.synced ? "success" : "info"
      );
      // Data may have changed — refresh everything.
      setSelectedLead(null);
      setSearch({ org: "", email: "", website: "" });
      setFilters(DEFAULT_FILTERS);
      setPage(1);
      loadMeta();
      fetchLeads();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Sync failed. Please try again.",
        "error"
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExport = (format: "csv" | "xlsx") => {
    const params = new URLSearchParams({
      format,
      ...(debouncedSearch.org && { org: debouncedSearch.org }),
      ...(debouncedSearch.email && { email: debouncedSearch.email }),
      ...(debouncedSearch.website && { website: debouncedSearch.website }),
      ...(filters.country && { country: filters.country }),
      ...(filters.buyer_type && { buyer_type: filters.buyer_type }),
      ...(filters.classification && { classification: filters.classification }),
      ...(filters.am && { am: filters.am }),
      ...(filters.confidence && { confidence: filters.confidence }),
    });
    window.open(`/api/leads/export?${params}`, "_blank");
    showToast(
      `Preparing ${format.toUpperCase()} export of ${leadsData.total.toLocaleString()} leads…`,
      "info"
    );
  };

  // Close drawer on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedLead(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50">
      {/* Header */}
      <MagazineHeader
        search={search}
        onSearchChange={setSearch}
        onSync={handleSync}
        onExport={handleExport}
        totalLeads={stats.total}
        isSyncing={isSyncing}
      />

      {/* Stats bar */}
      <div className="bg-white">
        <StatsBar stats={stats} />
      </div>

      {/* Main layout: sidebar + table */}
      <div className="flex flex-1 overflow-hidden">
        <FilterPanel
          filters={filters}
          options={filterOptions}
          onChange={(f) => {
            setFilters(f);
            setPage(1);
          }}
        />

        <main className="flex-1 flex flex-col overflow-hidden bg-white border-l border-zinc-100">
          {/* Section label */}
          <div className="px-6 py-3 border-b border-zinc-100 flex items-center gap-3">
            <span className="text-[10px] font-code font-bold uppercase tracking-widest text-editorial-muted">
              Leads
            </span>
            {!isLoading && (
              <span className="text-[10px] font-code text-editorial-muted">
                {leadsData.total.toLocaleString()} results
              </span>
            )}
          </div>

          <LeadsTable
            data={leadsData.data}
            total={leadsData.total}
            page={page}
            limit={50}
            isLoading={isLoading}
            error={leadsError}
            onRetry={fetchLeads}
            onClearAll={() => {
              setSearch({ org: "", email: "", website: "" });
              setFilters(DEFAULT_FILTERS);
              setPage(1);
            }}
            onRowClick={setSelectedLead}
            onPageChange={setPage}
            onSortChange={(s, o) => {
              setSort(s);
              setOrder(o);
              setPage(1);
            }}
          />
        </main>
      </div>

      {/* Lead Drawer */}
      <LeadDrawer lead={selectedLead} onClose={() => setSelectedLead(null)} />

      {/* Toast / status notifications */}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
