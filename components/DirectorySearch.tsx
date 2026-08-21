"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, ArrowRight } from "lucide-react";
import CountryFlag from "./CountryFlag";
import { primaryEmail } from "@/lib/format";
import type { Lead } from "@/lib/leads";

type DirectoryLead = Lead & { segmentLabel?: string };

function Field({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="min-w-0">
      <label className="block text-[10px] font-code font-bold uppercase tracking-widest mb-1.5 text-editorial-secondary">
        {label}
      </label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3.5 py-2.5 text-sm font-sans text-editorial-black border border-editorial-border rounded-lg bg-white placeholder:text-editorial-muted focus:outline-none focus:border-editorial-accent focus:ring-2 focus:ring-editorial-accent/25 transition-colors"
      />
    </div>
  );
}

/**
 * Cross-segment buyer search on the Directory chooser page. Lets a user who
 * knows a buyer's details — but not which segment they're in — find them
 * directly instead of guessing a card. Same field set as General Discovery,
 * minus the AI model picker (this is a plain lookup, not a research run).
 */
export default function DirectorySearch() {
  const router = useRouter();
  const [org, setOrg] = useState("");
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [country, setCountry] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<DirectoryLead[]>([]);

  const canSearch =
    !!(org.trim() || website.trim() || email.trim() || buyerName.trim() || country.trim()) &&
    !loading;

  const run = async () => {
    if (!canSearch) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        ...(org.trim() && { org: org.trim() }),
        ...(website.trim() && { website: website.trim() }),
        ...(email.trim() && { email: email.trim() }),
        ...(buyerName.trim() && { buyerName: buyerName.trim() }),
        ...(country.trim() && { country: country.trim() }),
      });
      const res = await fetch(`/api/leads/directory-search?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Search failed (${res.status})`);
      setResults(data.data ?? []);
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
      setResults([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  };

  const openLead = (lead: DirectoryLead) => {
    if (!lead.segment) return;
    router.push(`/directory/${lead.segment}?pickId=${lead.id}`);
  };

  return (
    <div className="rounded-xl border border-editorial-border bg-white shadow-sm overflow-hidden h-full">
      <div
        className="h-1 w-full"
        style={{
          background:
            "linear-gradient(90deg, #4F46E5 0%, #7C3AED 50%, #4F46E5 100%)",
        }}
        aria-hidden="true"
      />
      <div className="p-4 lg:p-5">
        <div className="flex items-center gap-2.5">
          <span
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
            style={{ background: "#E0E7FF" }}
          >
            <Search size={18} style={{ color: "#4F46E5" }} />
          </span>
          <div>
            <h2 className="font-display font-bold text-lg text-editorial-black">
              Know the buyer? Search directly
            </h2>
            <p className="text-xs text-editorial-secondary font-sans">
              Search across every live segment at once — no need to guess which one they're in.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="Organization" placeholder="Brand or company name" value={org} onChange={setOrg} />
          <Field label="Website URL" placeholder="example.com" value={website} onChange={setWebsite} />
          <Field label="Email ID" placeholder="name@company.com" value={email} onChange={setEmail} />
          <Field label="Buyer Name" placeholder="Contact person, if known" value={buyerName} onChange={setBuyerName} />
          <Field label="Country" placeholder="e.g. USA, UAE, Germany" value={country} onChange={setCountry} />
        </div>

        <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-editorial-muted">
            Fill any one field — more detail narrows the results.
          </p>
          <button
            onClick={run}
            disabled={!canSearch}
            className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-sans font-semibold rounded-lg text-white shadow-sm bg-editorial-accent hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
          >
            {loading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Searching…
              </>
            ) : (
              <>
                Search buyers
                <Search size={15} />
              </>
            )}
          </button>
        </div>

        {error && !loading && (
          <div className="error-banner mt-4 !mx-0">
            <p className="text-sm font-sans text-red-700">{error}</p>
          </div>
        )}

        {searched && !loading && !error && (
          <div className="mt-4 border-t border-editorial-border pt-4">
            {results.length === 0 ? (
              <p className="text-sm font-sans text-editorial-secondary">
                No buyers matched those details across the live segments.
              </p>
            ) : (
              <>
                <p className="text-xs font-code text-editorial-muted mb-2">
                  {results.length} match{results.length === 1 ? "" : "es"}
                </p>
                <ul className="divide-y divide-editorial-border">
                  {results.map((lead) => (
                    <li key={lead.id}>
                      <button
                        onClick={() => openLead(lead)}
                        className="group w-full flex items-center gap-3 py-3 text-left hover:bg-zinc-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-editorial-accent rounded"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-sans font-semibold text-sm text-editorial-black">
                              {lead.organization ?? "—"}
                            </span>
                            {lead.segmentLabel && (
                              <span className="text-[10px] font-code font-bold uppercase tracking-wide text-editorial-accent bg-indigo-50 border border-indigo-200 rounded px-1.5 py-0.5">
                                {lead.segmentLabel}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-xs font-sans text-editorial-secondary truncate">
                            {primaryEmail(lead.email, lead.full_name) ?? lead.website ?? "No contact on file"}
                          </div>
                        </div>
                        {lead.country && (
                          <span className="text-xs font-sans text-editorial-muted whitespace-nowrap flex items-center flex-shrink-0">
                            <CountryFlag country={lead.country} />
                            {lead.country}
                          </span>
                        )}
                        <ArrowRight
                          size={16}
                          className="text-editorial-muted flex-shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:text-editorial-black"
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
