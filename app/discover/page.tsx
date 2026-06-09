"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, CheckCircle2, ArrowRight, Globe, FileDown } from "lucide-react";
import Masthead from "@/components/Masthead";
import LeadDossier from "@/components/LeadDossier";
import Badge from "@/components/Badge";
import { downloadLeadPdf } from "@/lib/leadPdf";
import type { Lead } from "@/lib/leads";

type Profile = Record<string, string | null>;

function Input({
  label,
  placeholder,
  value,
  dot,
  ph,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  dot: string;
  ph: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex-1 min-w-0">
      <label
        className="block text-[10px] font-code font-bold uppercase tracking-widest mb-1"
        style={{ color: dot }}
      >
        {label}
      </label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{ ["--ph" as string]: ph }}
        className="search-input w-full px-3 py-2 text-sm font-sans text-editorial-black border border-zinc-200 rounded bg-white focus:outline-none focus:border-editorial-black focus-visible:ring-2 focus-visible:ring-editorial-accent transition-colors"
      />
    </div>
  );
}

export default function DiscoverPage() {
  const [org, setOrg] = useState("");
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    profile: Profile;
    savedId: number | null;
    updated: boolean;
  } | null>(null);

  const canRun = !!(org.trim() || website.trim() || email.trim()) && !loading;

  const run = async () => {
    if (!canRun) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org, website, email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Research failed (${res.status})`);
      if (data.error) throw new Error(data.error);
      setResult({
        profile: data.profile,
        savedId: data.savedId ?? null,
        updated: !!data.updated,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Research failed.");
    } finally {
      setLoading(false);
    }
  };

  const profile = result?.profile;
  const leadObj = (profile ?? {}) as unknown as Partial<Lead>;
  const orgName = profile?.organization || org || website || email;
  const website2 = profile?.website;

  return (
    <div className="min-h-screen flex flex-col bg-editorial-bg">
      <Masthead subtitle="General Discovery" />

      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-6 lg:px-10 py-8 lg:py-12">
          <div className="flex items-center gap-2.5">
            <Globe size={20} style={{ color: "#0D9488" }} />
            <h1 className="font-sans font-semibold text-2xl text-editorial-black">
              Research any buyer
            </h1>
          </div>
          <p className="mt-2 text-sm text-editorial-secondary max-w-xl">
            Enter what you know — an organization, a website, or an email. The web
            is scraped and an AI builds a full buyer profile, saved automatically
            so it shows up under{" "}
            <Link
              href="/directory/discover"
              className="text-editorial-accent hover:underline"
            >
              Discovered Buyers
            </Link>
            .
          </p>

          {/* Inputs */}
          <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-end">
            <Input
              label="Organization"
              placeholder="Enter Brand/Organization Name"
              value={org}
              dot="#4F46E5"
              ph="#A5B4FC"
              onChange={setOrg}
            />
            <Input
              label="Website URL"
              placeholder="Enter Website URL"
              value={website}
              dot="#B45309"
              ph="#D9A441"
              onChange={setWebsite}
            />
            <Input
              label="Email ID"
              placeholder="Enter Email ID"
              value={email}
              dot="#0D9488"
              ph="#5EB5AB"
              onChange={setEmail}
            />
            <button
              onClick={run}
              disabled={!canRun}
              className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-sans font-medium border border-zinc-800 rounded text-white bg-editorial-black hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Researching…
                </>
              ) : (
                "Research buyer"
              )}
            </button>
          </div>

          {/* Loading terminal */}
          {loading && (
            <div className="enrich-terminal mt-6">
              <div>› scraping website &amp; searching the web…</div>
              <div>› synthesizing a buyer profile with AI…</div>
              <div className="opacity-60">this usually takes ~15–30s.</div>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="error-banner mt-6 !mx-0">
              <p className="text-sm font-sans text-red-700">{error}</p>
              <button
                onClick={run}
                className="px-3 py-1.5 text-xs font-sans font-medium border border-red-300 rounded text-red-700 hover:bg-red-100 transition-colors cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {/* Result — same dossier layout as a known buyer */}
          {profile && !loading && (
            <div className="mt-8">
              <div className="flex items-center gap-2 text-xs font-sans text-green-700 mb-3">
                <CheckCircle2 size={14} />
                {result?.updated
                  ? "Updated in your database"
                  : "Saved to your database as a discovered buyer"}
                <Link
                  href="/directory/discover"
                  className="ml-1 inline-flex items-center gap-0.5 text-editorial-accent hover:underline"
                >
                  view all <ArrowRight size={11} />
                </Link>
              </div>

              <div className="bg-white border border-editorial-border rounded-md overflow-hidden">
                {/* accent strip */}
                <div
                  className="h-1 w-full"
                  style={{
                    background:
                      "linear-gradient(90deg, #4F46E5 0%, #7C3AED 30%, #0D9488 60%, #F59E0B 82%, #E11D48 100%)",
                  }}
                  aria-hidden="true"
                />
                <div className="px-6 pt-5 pb-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-sans font-semibold text-2xl text-editorial-black leading-tight text-balance">
                        {orgName}
                      </h2>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {profile.country && (
                          <span className="text-xs font-sans text-editorial-secondary">
                            {profile.country}
                          </span>
                        )}
                        {profile.website_confidence && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-code text-editorial-muted">
                            web <Badge value={profile.website_confidence} kind="web" />
                          </span>
                        )}
                        {website2 && (
                          <a
                            href={website2.startsWith("http") ? website2 : `https://${website2}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline font-sans"
                          >
                            {website2.replace(/^https?:\/\/(www\.)?/, "")}
                          </a>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => downloadLeadPdf(leadObj)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-sans font-medium border border-zinc-300 rounded text-editorial-secondary hover:border-editorial-black transition-colors cursor-pointer flex-shrink-0"
                    >
                      <FileDown size={13} />
                      Download PDF
                    </button>
                  </div>

                  <LeadDossier lead={leadObj} />
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
