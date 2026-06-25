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
  amAssigned?: number;
  lastSynced?: string | null;
}

interface FilterOptions {
  countries: string[];
  buyerTypes: string[];
  classifications: string[];
  ams: string[];
  orgScales?: string[];
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
  org_scale: "",
  unassigned: "",
  india: "",
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
  // Set when a typeahead pick optimistically filled the table — the confirming
  // background fetch then skips the loading skeleton (no flash).
  const optimisticPick = useRef(false);

  // Bulk-selection: ids ticked for assigning an AM to many leads at once.
  // Holds the full Lead objects so the bar can show a count and the optimistic
  // update can patch them without a refetch.
  const [selected, setSelected] = useState<Map<number, Lead>>(new Map());
  const [bulkAm, setBulkAm] = useState("");
  const [isBulkAssigning, setIsBulkAssigning] = useState(false);
  const clearSelection = useCallback(() => setSelected(new Map()), []);

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  // True after the user picks a buyer from the search dropdown: the dossier
  // opens and the table is hidden until they search again or browse the list.
  const [pickedMode, setPickedMode] = useState(false);

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
    if (!optimisticPick.current) setIsLoading(true);
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
        ...(filters.org_scale && { org_scale: filters.org_scale }),
        ...(filters.unassigned && { unassigned: filters.unassigned }),
        ...(filters.india && { india: filters.india }),
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
      optimisticPick.current = false;
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
      clearSelection();
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
        cur && cur.id === lead.id ? { ...cur, current_am: am, am_locked: true } : cur
      );
      setLeadsData((d) => ({
        ...d,
        data: d.data.map((l) =>
          l.id === lead.id ? { ...l, current_am: am, am_locked: true } : l
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

  const handleReleaseAm = async (lead: Lead) => {
    try {
      const res = await fetch("/api/leads/assign-am", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: lead.id, release: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);

      setSelectedLead((cur) =>
        cur && cur.id === lead.id ? { ...cur, am_locked: false } : cur
      );
      setLeadsData((d) => ({
        ...d,
        data: d.data.map((l) =>
          l.id === lead.id ? { ...l, am_locked: false } : l
        ),
      }));
      showToast(
        "Released — the next sync will use the sheet's AM for this lead.",
        "info"
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Couldn't release the AM.",
        "error"
      );
    }
  };

  const toggleRow = useCallback((lead: Lead) => {
    setSelected((cur) => {
      const next = new Map(cur);
      if (next.has(lead.id)) next.delete(lead.id);
      else next.set(lead.id, lead);
      return next;
    });
  }, []);

  const togglePage = useCallback((leads: Lead[], checked: boolean) => {
    setSelected((cur) => {
      const next = new Map(cur);
      if (checked) leads.forEach((l) => next.set(l.id, l));
      else leads.forEach((l) => next.delete(l.id));
      return next;
    });
  }, []);

  // Shared core for both bulk assign and bulk unassign. `unassign` clears the
  // AM ("No Active AM"); otherwise `bulkAm` is assigned. Both lock the leads.
  const runBulk = async (unassign: boolean) => {
    const ids = Array.from(selected.keys());
    if (ids.length === 0 || isBulkAssigning) return;
    if (!unassign && !bulkAm) return;
    if (
      unassign &&
      !window.confirm(
        `Clear the Account Manager on ${ids.length} selected lead${
          ids.length === 1 ? "" : "s"
        }? They'll be marked "No Active AM" and won't be re-assigned by a sheet sync until released.`
      )
    )
      return;

    setIsBulkAssigning(true);
    try {
      const res = await fetch("/api/leads/assign-am-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(unassign ? { ids, unassign: true } : { ids, am: bulkAm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);

      const newAm = data.am as string; // "No Active AM" when unassigning
      const idSet = new Set(ids);
      setLeadsData((d) => ({
        ...d,
        data: d.data.map((l) =>
          idSet.has(l.id) ? { ...l, current_am: newAm, am_locked: true } : l
        ),
      }));
      setSelectedLead((cur) =>
        cur && idSet.has(cur.id)
          ? { ...cur, current_am: newAm, am_locked: true }
          : cur
      );

      const sheetNote =
        data.sheetUpdated > 0
          ? ` (${data.sheetUpdated} written to Google Sheet${
              data.unmatched?.length
                ? `; ${data.unmatched.length} not found in sheet`
                : ""
            })`
          : data.sheetErrors?.length
          ? " — database saved, but the Google Sheet wasn't updated"
          : "";
      const verb = unassign ? "Unassigned" : `Assigned ${newAm} to`;
      showToast(
        `${verb} ${data.assigned} lead${
          data.assigned === 1 ? "" : "s"
        }${sheetNote}.`,
        data.sheetErrors?.length ? "info" : "success"
      );
      clearSelection();
      setBulkAm("");
      loadMeta(); // refresh the "assigned" stat + AM filter options
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Bulk update failed.",
        "error"
      );
    } finally {
      setIsBulkAssigning(false);
    }
  };

  const handleBulkAssign = () => runBulk(false);
  const handleBulkUnassign = () => runBulk(true);

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
      ...(filters.org_scale && { org_scale: filters.org_scale }),
      ...(filters.unassigned && { unassigned: filters.unassigned }),
      ...(filters.india && { india: filters.india }),
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

  // AM identity control — sits in the header next to Sync, bolded a touch.
  const amControl = canAssign ? (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-sans font-semibold text-editorial-secondary">
      <UserCheck size={12} className="text-green-600" />
      AM editing as{" "}
      <span className="font-bold text-editorial-black">{userEmail}</span>
      <button
        onClick={handleIdentify}
        className="ml-1 font-semibold text-editorial-accent hover:underline cursor-pointer"
      >
        change
      </button>
    </span>
  ) : (
    <button
      onClick={handleIdentify}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-sans font-bold border border-indigo-200 rounded text-editorial-accent hover:bg-indigo-50 hover:border-editorial-accent transition-colors cursor-pointer"
      title="Account Manager editing is limited to authorized users"
    >
      <Lock size={11} />
      {userEmail ? "View only · switch account" : "Sign in to edit AMs"}
    </button>
  );

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
        onSearchChange={(next) => {
          // Typing or clearing returns to the normal list view.
          setSearch(next);
          setPickedMode(false);
        }}
        onSync={handleSync}
        onExport={handleExport}
        totalLeads={stats.total}
        isSyncing={isSyncing}
        lastSynced={stats.lastSynced}
        segment={segment}
        amControl={amControl}
        suggest
        onPick={(lead) => {
          // Open the buyer's dossier directly and hide the table behind it.
          setSelectedLead(lead);
          setPickedMode(true);
        }}
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
          <div className="px-6 min-h-[45px] border-b border-zinc-300 flex items-center gap-3">
            <span className="text-sm font-sans font-semibold text-editorial-black">
              {segmentLabel}
            </span>
            {!isLoading && !pickedMode && (
              <span className="text-xs font-code text-editorial-muted">
                {leadsData.total.toLocaleString()} results
              </span>
            )}
          </div>

          {pickedMode ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16">
              <p className="font-sans text-sm text-editorial-secondary max-w-sm">
                Showing the buyer you selected. The list stays hidden while you
                review this profile.
              </p>
              <button
                onClick={() => {
                  setSearch({ org: "", email: "", website: "" });
                  setPickedMode(false);
                }}
                className="mt-4 inline-flex items-center px-4 py-2 text-xs font-sans font-bold rounded text-white bg-editorial-accent hover:bg-indigo-700 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-editorial-accent/50"
              >
                Browse the full list
              </button>
            </div>
          ) : (
            <>
              {/* Bulk-assign bar — appears once leads are ticked (editors only) */}
              {canAssign && selected.size > 0 && (
                <div className="flex flex-wrap items-center gap-3 px-6 py-2.5 border-b border-violet-200 bg-violet-50">
                  <span className="text-xs font-sans font-semibold text-violet-900">
                    {selected.size} selected
                  </span>
                  <button
                    onClick={clearSelection}
                    className="text-[11px] font-sans text-violet-700 hover:underline cursor-pointer"
                  >
                    Clear selection
                  </button>
                  <div className="ml-auto flex items-center gap-2">
                    <label
                      htmlFor="bulk-am"
                      className="text-[11px] font-sans text-editorial-secondary"
                    >
                      Assign to
                    </label>
                    <select
                      id="bulk-am"
                      value={bulkAm}
                      disabled={isBulkAssigning}
                      onChange={(e) => setBulkAm(e.target.value)}
                      className="text-xs font-sans border border-violet-300 rounded px-2 py-1.5 bg-white text-editorial-text focus:outline-none focus:border-violet-600 cursor-pointer disabled:opacity-50 max-w-[220px]"
                    >
                      <option value="">Select Account Manager…</option>
                      {filterOptions.ams
                        .filter((a) => a && a !== "No Active AM")
                        .map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                    </select>
                    <button
                      onClick={handleBulkAssign}
                      disabled={!bulkAm || isBulkAssigning}
                      className="inline-flex items-center px-3 py-1.5 text-xs font-sans font-bold rounded text-white bg-violet-600 hover:bg-violet-700 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
                    >
                      {isBulkAssigning
                        ? "Working…"
                        : `Assign (${selected.size})`}
                    </button>
                    <span className="text-zinc-300" aria-hidden="true">
                      |
                    </span>
                    <button
                      onClick={handleBulkUnassign}
                      disabled={isBulkAssigning}
                      title="Clear the Account Manager on the selected leads"
                      className="inline-flex items-center px-3 py-1.5 text-xs font-sans font-bold rounded border border-violet-300 text-violet-700 bg-white hover:bg-violet-100 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
                    >
                      Unassign
                    </button>
                  </div>
                </div>
              )}
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
                selectable={canAssign}
                selectedIds={new Set(selected.keys())}
                onToggleRow={toggleRow}
                onTogglePage={togglePage}
              />
            </>
          )}
        </main>
      </div>

      <LeadDrawer
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        amOptions={canAssign ? filterOptions.ams : undefined}
        onAssignAm={canAssign ? handleAssignAm : undefined}
        onReleaseAm={canAssign ? handleReleaseAm : undefined}
      />
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
