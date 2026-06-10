"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, CheckCircle2, ArrowRight, Globe, FileDown } from "lucide-react";
import Masthead from "@/components/Masthead";
import Aurora from "@/components/Aurora";
import RotatingWord from "@/components/RotatingWord";
import LeadDossier from "@/components/LeadDossier";
import Badge from "@/components/Badge";
import { downloadLeadPdf } from "@/lib/leadPdf";
import type { Lead } from "@/lib/leads";

type Profile = Record<string, string | null>;

const MODEL_OPTIONS = [
  { value: "haiku", label: "Claude Haiku (sharpest, most reliable)" },
  { value: "deepseek", label: "DeepSeek (faster, cheaper bulk runs)" },
  { value: "qwen", label: "Qwen (free, quick basic lookups)" },
];

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
        className="w-full px-3.5 py-2.5 text-sm font-sans text-editorial-black border border-editorial-border rounded-lg bg-white placeholder:text-editorial-muted focus:outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/25 transition-colors"
      />
    </div>
  );
}

export default function DiscoverPage() {
  const [org, setOrg] = useState("");
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [model, setModel] = useState("haiku");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    profile: Profile;
    savedId: number | null;
    updated: boolean;
    contactSource: string | null;
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
        body: JSON.stringify({ org, website, email, model }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Research failed (${res.status})`);
      if (data.error) throw new Error(data.error);
      setResult({
        profile: data.profile,
        savedId: data.savedId ?? null,
        updated: !!data.updated,
        contactSource: data.contactSource ?? null,
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
    <div className="min-h-screen flex flex-col bg-editorial-bg disp-grotesk">
      <Masthead subtitle="General Discovery" />

      <main className="flex-1 relative">
        <Aurora />
        <div className="relative z-10 max-w-3xl mx-auto px-6 lg:px-10 py-8 lg:py-12">
          {/* Header */}
          <div className="flex items-center gap-3">
            <span
              className="inline-flex items-center justify-center w-11 h-11 rounded-xl shrink-0"
              style={{ background: "#CCFBF1" }}
            >
              <Globe size={22} style={{ color: "#0D9488" }} />
            </span>
            <h1 className="font-display font-bold text-3xl lg:text-[2rem] leading-none text-editorial-black">
              Research any{" "}
              <RotatingWord
                words={["Prospect", "Lead", "Customer"]}
                intervalMs={2000}
              />
            </h1>
          </div>
          <p className="mt-3 text-sm text-editorial-secondary max-w-xl leading-relaxed">
            Enter what you know — an organization, a website, or an email. The web
            is scraped and an AI builds a full buyer profile, saved automatically
            so it shows up under{" "}
            <Link
              href="/directory/discover"
              className="font-semibold text-[#0D9488] hover:underline"
            >
              Discovered Buyers
            </Link>
            .
          </p>

          {/* Input card */}
          <div className="mt-7 rounded-xl border border-editorial-border bg-white shadow-sm overflow-hidden">
            <div
              className="h-1 w-full"
              style={{
                background:
                  "linear-gradient(90deg, #0D9488 0%, #2DD4BF 50%, #0D9488 100%)",
              }}
              aria-hidden="true"
            />
            <div className="p-5 lg:p-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field
                  label="Organization"
                  placeholder="Brand or company name"
                  value={org}
                  onChange={setOrg}
                />
                <Field
                  label="Website URL"
                  placeholder="example.com"
                  value={website}
                  onChange={setWebsite}
                />
                <Field
                  label="Email ID"
                  placeholder="name@company.com"
                  value={email}
                  onChange={setEmail}
                />
              </div>
              <div className="mt-4">
                <label className="block text-[10px] font-code font-bold uppercase tracking-widest mb-1.5 text-editorial-secondary">
                  AI Model
                </label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full sm:w-auto px-3.5 py-2.5 text-sm font-sans text-editorial-black border border-editorial-border rounded-lg bg-white focus:outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/25 transition-colors cursor-pointer"
                >
                  {MODEL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-editorial-muted">
                  Fill any one field — more detail sharpens the profile.
                </p>
                <button
                  onClick={run}
                  disabled={!canRun}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-sans font-semibold rounded-lg text-white shadow-sm bg-[#0D9488] hover:bg-[#0F766E] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                >
                  {loading ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Researching…
                    </>
                  ) : (
                    <>
                      Research buyer
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </div>
            </div>
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
                {result?.contactSource && (
                  <span className="text-editorial-muted">
                    · contact via {result.contactSource}
                  </span>
                )}
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
