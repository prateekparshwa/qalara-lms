"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bell, Loader2 } from "lucide-react";
import Masthead from "@/components/Masthead";
import Badge from "@/components/Badge";
import { getStoredEmail, setStoredEmail } from "@/lib/access";
import { relativeDate, outreachStatus } from "@/lib/format";

interface BriefLead {
  id: number | null;
  organization: string | null;
  segment: string | null;
  country: string | null;
  buyer_classification: string | null;
  current_am: string | null;
  notes: string | null;
}
interface BriefEntry {
  assignedAt: string;
  assignedBy: string | null;
  fromAm: string | null;
  toAm: string;
  lead: BriefLead | null;
}
interface BriefResult {
  amName: string | null;
  configured: boolean;
  lastSeenAt: string | null;
  count: number;
  entries: BriefEntry[];
}

/** "Today" / "Yesterday" / "Mon, 8 Sep" bucket for an ISO timestamp. */
function dayBucket(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(today) - startOf(d)) / 86400_000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export default function BriefPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [data, setData] = useState<BriefResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailInput, setEmailInput] = useState("");

  useEffect(() => {
    setEmail(getStoredEmail());
  }, []);

  const load = useCallback(async (e: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/brief?email=${encodeURIComponent(e)}`);
      const json: BriefResult = await res.json();
      setData(json);
      // Mark seen AFTER we have the pre-visit count.
      if (json.configured) {
        fetch("/api/brief/seen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: e }),
        }).catch(() => {});
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (email) load(email);
    else setLoading(false);
  }, [email, load]);

  const saveEmail = () => {
    const e = emailInput.trim().toLowerCase();
    if (!e) return;
    setStoredEmail(e);
    setEmail(e);
  };

  const grouped: [string, BriefEntry[]][] = [];
  if (data?.entries?.length) {
    const map = new Map<string, BriefEntry[]>();
    for (const en of data.entries) {
      const k = dayBucket(en.assignedAt);
      const arr = map.get(k);
      if (arr) arr.push(en);
      else map.set(k, [en]);
    }
    grouped.push(...Array.from(map.entries()));
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F4EF]">
      <Masthead subtitle="Your Daily Brief" />
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 lg:px-10 py-10">
        <div className="flex items-center gap-2 mb-1">
          <Bell size={18} className="text-editorial-accent" />
          <h1 className="font-sans font-semibold text-2xl text-editorial-black">
            {data?.amName ? `${data.amName}'s brief` : "Your brief"}
          </h1>
        </div>
        <p className="text-sm text-editorial-muted font-sans mb-8">
          Leads assigned to you since you last checked
          {data?.lastSeenAt ? ` · ${relativeDate(data.lastSeenAt)}` : " · last 7 days"}.
        </p>

        {loading && (
          <div className="flex items-center gap-2 text-editorial-muted text-sm font-sans">
            <Loader2 size={14} className="animate-spin" /> Loading…
          </div>
        )}

        {!loading && !email && (
          <div className="bg-white border border-editorial-border rounded-md p-6 max-w-md">
            <p className="text-sm font-sans text-editorial-text mb-3">
              Enter your Qalara email so we know whose brief to show.
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveEmail()}
                placeholder="you@qalara.com"
                className="flex-1 text-sm font-sans border border-zinc-300 rounded px-2 py-1.5 focus:outline-none focus:border-editorial-black"
              />
              <button
                onClick={saveEmail}
                className="px-3 py-1.5 text-xs font-sans font-bold rounded text-white bg-editorial-accent hover:bg-indigo-700 transition-colors cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        )}

        {!loading && email && data && !data.configured && (
          <div className="bg-white border border-editorial-border rounded-md p-6 max-w-lg">
            <p className="text-sm font-sans text-editorial-text">
              <span className="font-semibold">{email}</span> isn&apos;t linked to an Account
              Manager yet, so there&apos;s no brief to show. Ask an admin to add you to the
              AM directory.
            </p>
            <button
              onClick={() => {
                setStoredEmail("");
                setEmail("");
              }}
              className="mt-3 text-xs font-sans font-semibold text-editorial-accent hover:underline cursor-pointer"
            >
              Use a different email
            </button>
          </div>
        )}

        {!loading && data?.configured && data.entries.length === 0 && (
          <div className="bg-white border border-editorial-border rounded-md p-8 text-center">
            <p className="font-sans text-editorial-secondary">
              Nothing new — no leads have been assigned to you since your last visit.
            </p>
          </div>
        )}

        {!loading && data?.configured && grouped.length > 0 && (
          <div className="space-y-8">
            {grouped.map(([day, entries]) => (
              <section key={day}>
                <h2 className="text-[11px] font-code font-bold uppercase tracking-widest text-editorial-muted mb-2">
                  {day} · {entries.length}
                </h2>
                <div className="space-y-2">
                  {entries.map((en, i) => {
                    const lead = en.lead;
                    const remark = outreachStatus(lead?.notes);
                    return (
                      <div
                        key={`${en.assignedAt}-${i}`}
                        className="bg-white border border-editorial-border rounded-md px-4 py-3 flex items-start justify-between gap-4"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-sans font-semibold text-sm text-editorial-black">
                              {lead?.organization ?? en.lead?.organization ?? "(lead not found)"}
                            </span>
                            {lead?.country && (
                              <span className="text-xs font-sans text-editorial-secondary">
                                {lead.country}
                              </span>
                            )}
                            {lead?.buyer_classification && (
                              <Badge value={lead.buyer_classification} kind="priority" />
                            )}
                          </div>
                          <div className="text-xs font-sans text-editorial-muted mt-1">
                            {en.fromAm && en.fromAm !== "No Active AM"
                              ? `${en.fromAm} → ${en.toAm}`
                              : `Assigned to ${en.toAm}`}
                            {en.assignedBy ? ` · by ${en.assignedBy}` : ""}
                            {` · ${relativeDate(en.assignedAt)}`}
                          </div>
                          {remark && (
                            <div className="text-xs font-sans text-editorial-secondary mt-1">
                              Remark: {remark}
                            </div>
                          )}
                        </div>
                        {lead?.id && lead.segment && (
                          <Link
                            href={`/directory/${lead.segment}?pickId=${lead.id}`}
                            className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-sans font-semibold text-editorial-accent hover:underline"
                          >
                            Open <ArrowRight size={12} />
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
