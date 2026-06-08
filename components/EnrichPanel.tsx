"use client";

import { useState } from "react";
import { Globe, Search, Zap, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import type { Lead } from "@/lib/leads";

type EnrichType = "scrape" | "search" | "apify";

interface EnrichResult {
  cached: boolean;
  result: unknown;
  query?: string;
  error?: string;
}

function ResultDisplay({ result }: { result: EnrichResult }) {
  const text =
    typeof result.result === "string"
      ? result.result
      : JSON.stringify(result.result, null, 2);

  return (
    <div className="enrich-terminal mt-3">
      {result.cached && (
        <div className="text-zinc-500 text-[10px] mb-2 pb-2 border-b border-zinc-700">
          CACHED RESULT — fetched previously
        </div>
      )}
      {result.query && (
        <div className="text-zinc-400 text-[10px] mb-2">
          Query: {result.query}
        </div>
      )}
      {result.error ? (
        <div className="text-red-400">[ERROR] {result.error}</div>
      ) : (
        <pre className="whitespace-pre-wrap break-words text-[11px]">{text}</pre>
      )}
    </div>
  );
}

export default function EnrichPanel({ lead }: { lead: Lead }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<EnrichType | null>(null);
  const [results, setResults] = useState<Partial<Record<EnrichType, EnrichResult>>>({});

  const run = async (type: EnrichType) => {
    setLoading(type);
    try {
      let res: Response;
      if (type === "scrape") {
        res = await fetch("/api/enrich/scrape", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId: lead.id, url: lead.website }),
        });
      } else if (type === "search") {
        res = await fetch("/api/enrich/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leadId: lead.id,
            org: lead.organization,
            country: lead.country,
            categories: lead.categories,
          }),
        });
      } else {
        res = await fetch("/api/enrich/apify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leadId: lead.id,
            org: lead.organization,
            url: lead.website,
            email: lead.email,
          }),
        });
      }
      const data = await res.json();
      setResults((prev) => ({ ...prev, [type]: data }));
    } catch (err) {
      setResults((prev) => ({
        ...prev,
        [type]: { cached: false, result: null, error: String(err) },
      }));
    } finally {
      setLoading(null);
    }
  };

  const actions: { type: EnrichType; icon: React.ReactNode; label: string; desc: string; disabled?: boolean }[] = [
    {
      type: "scrape",
      icon: <Globe size={12} />,
      label: "Scrape Website",
      desc: "Firecrawl — extract full page content",
      disabled: !lead.website,
    },
    {
      type: "search",
      icon: <Search size={12} />,
      label: "Web Search",
      desc: "tinyfish.ai — find org online",
    },
    {
      type: "apify",
      icon: <Zap size={12} />,
      label: "Apify Lookup",
      desc: "Run actor — LinkedIn / company data",
    },
  ];

  return (
    <div className="border-t border-zinc-200 mt-6">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-zinc-50 transition-colors cursor-pointer"
      >
        <div>
          <div className="flex items-center gap-2">
            <Zap size={13} className="text-editorial-accent" />
            <span className="text-xs font-code font-bold uppercase tracking-widest text-editorial-black">
              Live Intelligence
            </span>
          </div>
          <p className="text-[11px] text-editorial-muted font-sans mt-0.5">
            Run real-time lookups on this lead
          </p>
        </div>
        {open ? (
          <ChevronDown size={14} className="text-editorial-muted" />
        ) : (
          <ChevronRight size={14} className="text-editorial-muted" />
        )}
      </button>

      {open && (
        <div className="px-6 pb-6">
          <div className="rule mb-4" />
          <div className="space-y-3">
            {actions.map(({ type, icon, label, desc, disabled }) => (
              <div key={type}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-editorial-muted">{icon}</span>
                      <span className="text-xs font-sans font-semibold text-editorial-black">
                        {label}
                      </span>
                    </div>
                    <p className="text-[10px] text-editorial-muted font-sans ml-4.5">
                      {desc}
                    </p>
                  </div>
                  <button
                    onClick={() => run(type)}
                    disabled={!!loading || disabled}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-sans font-medium border border-editorial-black rounded hover:bg-editorial-black hover:text-white transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {loading === type ? (
                      <>
                        <Loader2 size={10} className="animate-spin" />
                        Running…
                      </>
                    ) : (
                      "Run"
                    )}
                  </button>
                </div>
                {results[type] && <ResultDisplay result={results[type]!} />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
