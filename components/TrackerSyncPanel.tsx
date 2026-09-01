"use client";

import { useState, useCallback, useRef } from "react";
import { RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import Toast, { ToastState, ToastType } from "@/components/Toast";

interface PreviewOrg {
  org: string;
  country: string | null;
  contact: string | null;
  sources: string[];
  targetSegment: "engagement" | "customers";
}

interface Preview {
  newCount: number;
  alreadyMatchedCount: number;
  totalTrackerOrgs: number;
  newOrgs: PreviewOrg[];
}

const SEGMENT_LABEL: Record<string, string> = {
  engagement: "Lead (Qalara Qualified)",
  customers: "Qalara Customers",
};

/**
 * Cross-segment "Leads&Enqs Tracker" sync — lives on the directory lobby
 * (not a per-segment page) since a new org can land in either Engagement or
 * Customers depending on whether EnquiryTracker shows an Order ID for it.
 * Always previews first (dry run — nothing written), then creates a small
 * batch at a time via web research, same safety pattern as Pull HubSpot.
 */
export default function TrackerSyncPanel() {
  const [checking, setChecking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastKey = useRef(0);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    toastKey.current += 1;
    setToast({ message, type, key: toastKey.current });
  }, []);

  const runCheck = async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/leads/tracker-sync", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Check failed (${res.status})`);
      if (typeof data.newCount !== "number") {
        showToast(data.message || "Tracker sync unavailable.", "info");
        setPreview(null);
        return;
      }
      setPreview({
        newCount: data.newCount,
        alreadyMatchedCount: data.alreadyMatchedCount,
        totalTrackerOrgs: data.totalTrackerOrgs,
        newOrgs: data.newOrgs ?? [],
      });
      setExpanded(true);
      showToast(data.message, data.newCount > 0 ? "info" : "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Tracker check failed.", "error");
    } finally {
      setChecking(false);
    }
  };

  const createBatch = async () => {
    if (!preview || preview.newCount === 0) return;
    const batchSize = Math.min(5, preview.newCount);
    if (
      !window.confirm(
        `Create the next ${batchSize} of ${preview.newCount} new org(s)? Each is researched from the web (org name + country only), so this can take a minute or two.`
      )
    ) {
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`/api/leads/tracker-sync?commit=true&limit=${batchSize}`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Create failed (${res.status})`);
      showToast(data.message || "Batch complete.", data.failed ? "info" : "success");
      // Re-check so the preview list/count reflects what's left.
      await runCheck();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Tracker create failed.", "error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mt-6 border border-editorial-black">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/60 transition-colors"
      >
        <div>
          <span className="font-display font-semibold text-base text-editorial-black">
            Leads&Enqs Tracker
          </span>
          <p className="mt-0.5 text-xs text-editorial-muted font-sans">
            Check ByrMaster + EnquiryTracker for orgs not yet in Customers or
            Lead (Qalara Qualified), and create just those.
          </p>
        </div>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {expanded && (
        <div className="border-t border-editorial-border px-4 py-3.5 space-y-3">
          <div className="flex items-center gap-2">
            <button
              onClick={runCheck}
              disabled={checking}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-sans font-medium border border-indigo-200 rounded text-editorial-accent hover:bg-indigo-50 hover:border-editorial-accent transition-colors duration-150 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={12} className={checking ? "animate-spin" : ""} />
              {checking ? "Checking…" : "Check for new orgs"}
            </button>

            {preview && preview.newCount > 0 && (
              <button
                onClick={createBatch}
                disabled={creating}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-sans font-medium border border-emerald-200 rounded text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400 transition-colors duration-150 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw size={12} className={creating ? "animate-spin" : ""} />
                {creating
                  ? "Creating…"
                  : `Create next ${Math.min(5, preview.newCount)} of ${preview.newCount}`}
              </button>
            )}
          </div>

          {preview && (
            <div className="text-xs font-sans text-editorial-secondary">
              {preview.totalTrackerOrgs} tracker org(s) checked —{" "}
              {preview.alreadyMatchedCount} already in the LMS,{" "}
              <span className="font-semibold text-editorial-black">
                {preview.newCount} new
              </span>
              .
            </div>
          )}

          {preview && preview.newOrgs.length > 0 && (
            <div className="max-h-64 overflow-y-auto border border-editorial-border rounded">
              <table className="w-full text-xs font-sans">
                <thead className="sticky top-0 bg-[#F5F4EF]">
                  <tr className="text-left text-editorial-muted">
                    <th className="px-2 py-1.5 font-medium">Org</th>
                    <th className="px-2 py-1.5 font-medium">Country</th>
                    <th className="px-2 py-1.5 font-medium">Source</th>
                    <th className="px-2 py-1.5 font-medium">Goes to</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.newOrgs.map((o, i) => (
                    <tr key={i} className="border-t border-editorial-border">
                      <td className="px-2 py-1.5 text-editorial-black">{o.org}</td>
                      <td className="px-2 py-1.5 text-editorial-secondary">
                        {o.country || "—"}
                      </td>
                      <td className="px-2 py-1.5 text-editorial-secondary">
                        {o.sources.join(" + ")}
                      </td>
                      <td className="px-2 py-1.5 text-editorial-secondary">
                        {SEGMENT_LABEL[o.targetSegment] ?? o.targetSegment}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
