"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import MagazineHeader from "@/components/MagazineHeader";
import StatsBar from "@/components/StatsBar";
import FilterPanel, { Filters } from "@/components/FilterPanel";
import LeadsTable from "@/components/LeadsTable";
import LeadDrawer from "@/components/LeadDrawer";
import Toast, { ToastState, ToastType } from "@/components/Toast";
import type { Lead } from "@/lib/leads";
import { canEditAm, getStoredEmail, setStoredEmail } from "@/lib/access";
import { UserCheck, Lock } from "lucide-react";

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

interface LeadsDashboardProps {
  /** Segment key (engagement / no_engagement / prospects / discover). */
  segment: string;
  /** Human label shown in the header dateline ("Leads with Engagement"). */
  segmentLabel: string;
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

export default function LeadsDashboard({
  segment,
  segmentLabel,
}: LeadsDashboardProps) {
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
  const [sort, setSort] = useState("buyer_classification");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

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

  // Soft identity (shared Basic-Auth login carries no per-user identity, so the
  // user self-identifies; only the hard-coded AM editors get the assign control).
  const [userEmail, setUserEmail] = useState("");
  useEffect(() => {
    setUserEmail(getStoredEmail());
  }, []);
  const canAssign = canEditAm(userEmail);

  const [toast, setToast] = useState<ToastState | null>(null);
  const toastKey = useRef(0);
  const showToast = useCallback((message: string, type: ToastType = "info") => {
    toastKey.current += 1;
    setToast({ message, type, key: toastKey.current });
  }, []);

  const debouncedSearch = useDebounce(search, 300);

  // Load stats + filter options (on mount / segment change / after sync)
  const loadMeta = useCallback(() => {
    fetch(`/api/leads/stats?segment=${segment}`)
      .then((r) => {
        if (!r.ok) throw new Error("stats");
        return r.json();
      })
      .then(setStats)
      .catch(() => showToast("Couldn't load summary stats.", "error"));

    fetch(`/api/leads/filter-options?segment=${segment}`)
      .then((r) => {
        if (!r.ok) throw new Error("filter-options");
        return r.json();
      })
      .then(setFilterOptions)
      .catch(() => showToast("Couldn't load filter options.", "error"));
  }, [segment, showToast]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  // Load leads whenever segment/query/filters/page/sort change
  const fetchLeads = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        segment,
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
  }, [segment, debouncedSearch, filters, page, sort, order]);

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
      const res = await fetch(`/api/leads/sync?segment=${segment}`, {
        method: "POST",
      });
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

  const handleAssignAm = async (lead: Lead, am: string) => {
    try {
      const res = await fetch("/api/leads/assign-am", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: lead.id, am }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);

      // Reflect the change everywhere on screen without a refetch.
      setSelectedLead((cur) =>
        cur && cur.id === lead.id ? { ...cur, current_am: am } : cur
      );
      setLeadsData((d) => ({
        ...d,
        data: d.data.map((l) =>
          l.id === lead.id ? { ...l, current_am: am } : l
        ),
      }));

      if (data.sheet === "updated") {
        showToast(`Assigned ${am} — saved to database and Google Sheet.`, "success");
      } else {
        showToast(
          `Assigned ${am} — saved to database, but the Google Sheet wasn't updated${
            data.sheetError ? `: ${data.sheetError}` : "."
          }`,
          "info"
        );
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Couldn't assign the AM.",
        "error"
      );
    }
  };

  const handleIdentify = () => {
    const input = window.prompt(
      "Enter your Qalara email to enable Account Manager editing:",
      userEmail
    );
    if (input === null) return; // cancelled
    const e = input.trim().toLowerCase();
    setStoredEmail(e);
    setUserEmail(e);
    if (!e) {
      showToast("Signed out. AM editing is now hidden.", "info");
    } else if (canEditAm(e)) {
      showToast("AM editing enabled.", "success");
    } else {
      showToast(
        "That email doesn't have AM-edit access — you can still browse.",
        "info"
      );
    }
  };

  const handleExport = (format: "csv" | "xlsx") => {
    const params = new URLSearchParams({
      segment,
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
    <div className="min-h-screen flex flex-col bg-editorial-bg">
      {/* Amber vignette around the viewport edges — sits under drawer/toast */}
      <div
        className="pointer-events-none fixed inset-0 z-30"
        aria-hidden="true"
        style={{ boxShadow: "inset 0 0 140px rgba(245,158,11,0.25)" }}
      />
      <MagazineHeader
        segmentLabel={segmentLabel}
        backHref="/directory"
        search={search}
        onSearchChange={setSearch}
        onSync={handleSync}
        onExport={handleExport}
        totalLeads={stats.total}
        isSyncing={isSyncing}
        segment={segment}
        suggest
      />

      <div className="bg-white">
        <StatsBar stats={stats} />
      </div>

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
          <div className="px-6 py-3 border-b border-zinc-100 flex items-center gap-3">
            <span className="text-sm font-sans font-semibold text-editorial-black">
              {segmentLabel}
            </span>
            {!isLoading && (
              <span className="text-xs font-code text-editorial-muted">
                {leadsData.total.toLocaleString()} results
              </span>
            )}
            {/* Soft identity control — gates AM editing to the allowlist */}
            <div className="ml-auto flex items-center">
              {canAssign ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-sans text-editorial-secondary">
                  <UserCheck size={12} className="text-green-600" />
                  AM editing as{" "}
                  <span className="font-medium text-editorial-black">
                    {userEmail}
                  </span>
                  <button
                    onClick={handleIdentify}
                    className="ml-1 text-editorial-accent hover:underline cursor-pointer"
                  >
                    change
                  </button>
                </span>
              ) : (
                <button
                  onClick={handleIdentify}
                  className="inline-flex items-center gap-1.5 text-[11px] font-sans text-editorial-muted hover:text-editorial-black cursor-pointer"
                  title="Account Manager editing is limited to authorized users"
                >
                  <Lock size={11} />
                  {userEmail ? "View only · switch account" : "Sign in to edit AMs"}
                </button>
              )}
            </div>
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

      <LeadDrawer
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        amOptions={canAssign ? filterOptions.ams : undefined}
        onAssignAm={canAssign ? handleAssignAm : undefined}
      />
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
