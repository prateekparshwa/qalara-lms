"use client";

import { useState } from "react";
import {
  Globe,
  Search,
  Zap,
  ChevronDown,
  ChevronRight,
  Loader2,
  UserSearch,
  Mail,
  Phone,
  ExternalLink,
} from "lucide-react";
import type { Lead } from "@/lib/leads";
import type { DecisionMaker } from "@/lib/apollo";

type EnrichType = "contact" | "scrape" | "search" | "apify";

interface EnrichResult {
  cached: boolean;
  result: unknown;
  query?: string;
  error?: string;
}

interface ContactResponse {
  contact?: DecisionMaker;
  filled?: string[];
  note?: string;
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
        <div className="text-zinc-400 text-[10px] mb-2">Query: {result.query}</div>
      )}
      {result.error ? (
        <div className="text-red-400">[ERROR] {result.error}</div>
      ) : (
        <pre className="whitespace-pre-wrap break-words text-[11px]">{text}</pre>
      )}
    </div>
  );
}

function ContactResult({ data }: { data: ContactResponse }) {
  if (data.error) {
    return (
      <div className="enrich-terminal mt-3">
        <div className="text-red-400">[ERROR] {data.error}</div>
      </div>
    );
  }
  const c = data.contact;
  if (!c) return null;
  return (
    <div className="mt-3 rounded border border-editorial-border bg-white p-3">
      <div className="font-sans font-semibold text-sm text-editorial-black">
        {c.full_name ?? "Contact found"}
      </div>
      {c.designation && (
        <div className="text-xs font-sans text-editorial-secondary mt-0.5">
          {c.designation}
        </div>
      )}
      <div className="mt-2 space-y-1">
        {c.email && (
          <a
            href={`mailto:${c.email}`}
            className="flex items-center gap-1.5 text-xs text-editorial-accent hover:underline font-sans break-all"
          >
            <Mail size={12} /> {c.email}
          </a>
        )}
        {c.phone && (
          <div className="flex items-center gap-1.5 text-xs text-editorial-secondary font-sans">
            <Phone size={12} /> {c.phone}
          </div>
        )}
        {c.linkedin_url && (
          <a
            href={c.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-sans"
          >
            <ExternalLink size={12} /> LinkedIn
          </a>
        )}
      </div>
      <div className="mt-2 text-[10px] font-code text-editorial-muted">
        via {c.source}
        {data.filled && data.filled.length > 0
          ? ` · saved: ${data.filled.join(", ")}`
          : !c.email && !c.phone
          ? ""
          : " · already on file"}
      </div>
      {data.note && (
        <div className="mt-1 text-[10px] font-sans text-amber-700">{data.note}</div>
      )}
    </div>
  );
}

export default function EnrichPanel({ lead }: { lead: Lead }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<EnrichType | null>(null);
  const [results, setResults] = useState<{
    contact?: ContactResponse;
    scrape?: EnrichResult;
    search?: EnrichResult;
    apify?: EnrichResult;
  }>({});

  const run = async (type: EnrichType) => {
    setLoading(type);
    try {
      if (type === "contact") {
        const res = await fetch("/api/find-contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leadId: lead.id,
            org: lead.organization,
            website: lead.website,
          }),
        });
        const data = await res.json();
        setResults((p) => ({ ...p, contact: data }));
        return;
      }

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
      if (type === "contact") {
        setResults((p) => ({ ...p, contact: { error: String(err) } }));
      } else {
        setResults((prev) => ({
          ...prev,
          [type]: { cached: false, result: null, error: String(err) },
        }));
      }
    } finally {
      setLoading(null);
    }
  };

  const actions: {
    type: EnrichType;
    icon: React.ReactNode;
    label: string;
    /** Underlying tool, rendered as a "via <link>" hyperlink before the desc. */
    source: { label: string; url: string };
    desc: string;
    disabled?: boolean;
  }[] = [
    {
      type: "contact",
      icon: <UserSearch size={12} />,
      label: "Find Decision-Maker",
      source: { label: "hunter.io", url: "https://hunter.io" },
      desc: "finds a procurement/sourcing decision-maker: name, title, email, phone & LinkedIn (saved to the lead).",
      disabled: !lead.website,
    },
    {
      type: "scrape",
      icon: <Globe size={12} />,
      label: "Scrape Website",
      source: { label: "tinyfish.ai", url: "https://tinyfish.ai" },
      desc: "extracts the site's full page content (about, products, materials & markets) to enrich the profile.",
      disabled: !lead.website,
    },
    {
      type: "search",
      icon: <Search size={12} />,
      label: "Web Search",
      source: { label: "tinyfish.ai", url: "https://tinyfish.ai" },
      desc: "surfaces the organization online: business profile, listings & recent mentions.",
    },
    {
      type: "apify",
      icon: <Zap size={12} />,
      label: "Apify Lookup",
      source: { label: "apify.com", url: "https://apify.com" },
      desc: "pulls structured company data: org size, social handles & public contact details.",
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
            {actions.map(({ type, icon, label, source, desc, disabled }) => (
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
                      via{" "}
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-editorial-accent hover:underline"
                      >
                        {source.label}
                      </a>{" "}
                      — {desc}
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
                {type === "contact"
                  ? results.contact && <ContactResult data={results.contact} />
                  : results[type] && (
                      <ResultDisplay result={results[type] as EnrichResult} />
                    )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
