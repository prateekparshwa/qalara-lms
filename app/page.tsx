import Link from "next/link";
import { ArrowRight, Search, Globe, Database } from "lucide-react";
import Masthead from "@/components/Masthead";
import Aurora from "@/components/Aurora";
import CountUp from "@/components/CountUp";
import { getLeadStats, getLastSynced } from "@/lib/leads";
import { SEGMENTS } from "@/lib/segments";

// Live numbers — never statically cached.
export const dynamic = "force-dynamic";

function formatSynced(iso: string | null): string {
  if (!iso) return "not yet synced";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "recently";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

interface Stats {
  total: number;
  verified: number;
  highConfidence: number;
}

export default async function LobbyPage({
  searchParams,
}: {
  searchParams?: { v?: string; font?: string };
}) {
  let stats: Stats = { total: 0, verified: 0, highConfidence: 0 };
  let lastSynced: string | null = null;
  try {
    const [s, synced] = await Promise.all([getLeadStats(), getLastSynced()]);
    stats = {
      total: s.total,
      verified: s.verified,
      highConfidence: s.highConfidence,
    };
    lastSynced = synced;
  } catch {
    // Lobby still renders if the DB is briefly unreachable.
  }

  // Defaults: Classic layout + Fraunces font.
  const variant = searchParams?.v === "deck" ? "deck" : "classic";
  const font =
    searchParams?.font === "grotesk"
      ? "grotesk"
      : searchParams?.font === "bricolage"
      ? "bricolage"
      : "fraunces";
  const fontClass =
    font === "grotesk"
      ? "disp-grotesk"
      : font === "bricolage"
      ? "disp-bricolage"
      : "disp-fraunces";

  return (
    <div className={`min-h-screen flex flex-col bg-editorial-bg ${fontClass}`}>
      <Masthead />

      <main className="flex-1 relative">
        <Aurora />

        <div className="relative z-10 max-w-6xl mx-auto px-6 lg:px-10 pt-12 lg:pt-16 pb-16">
          {/* Dateline / live signal */}
          <p
            className="reveal text-xs font-code text-editorial-secondary font-semibold tracking-wide"
            style={{ animationDelay: "0ms" }}
          >
            {stats.total.toLocaleString()} buyers in the database · last synced{" "}
            {formatSynced(lastSynced)}
          </p>

          <h1
            className="reveal mt-4 max-w-3xl font-display font-bold text-4xl lg:text-5xl leading-[1.18] text-editorial-black text-balance"
            style={{ animationDelay: "60ms" }}
          >
            Find a known buyer, or{" "}
            <span className="text-gradient">discover a new one.</span>
          </h1>

          {variant === "deck" ? (
            <CommandDeck stats={stats} lastSynced={lastSynced} />
          ) : (
            <ClassicLobby />
          )}

        </div>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Command Deck — distinct light "index" card + dark "radar" card     */
/* ------------------------------------------------------------------ */
function CommandDeck({
  stats,
  lastSynced,
}: {
  stats: Stats;
  lastSynced: string | null;
}) {
  const kpis: Array<{
    n?: number;
    text?: string;
    label: string;
    cls: string;
  }> = [
    { n: stats.total, label: "Buyers", cls: "kpi-indigo" },
    { n: stats.verified, label: "With Website", cls: "kpi-teal" },
    { n: stats.highConfidence, label: "High Confidence", cls: "kpi-amber" },
    { text: formatSynced(lastSynced), label: "Last Synced", cls: "kpi-rose" },
  ];

  return (
    <>
      <div className="deck-grid mt-6 lg:mt-7">
        {/* LEFT — Directory as a light index / database */}
        <Link
          href="/directory"
          className="reveal deck-index group"
          style={{ animationDelay: "120ms" }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Search size={18} className="text-editorial-accent" />
              <span className="font-code text-xs font-bold uppercase tracking-widest text-editorial-secondary">
                Directory
              </span>
            </div>
            <ArrowRight
              size={18}
              className="text-editorial-muted transition-transform duration-200 group-hover:translate-x-1 group-hover:text-editorial-black"
            />
          </div>

          <h2 className="mt-5 font-display font-bold text-2xl lg:text-[1.65rem] text-editorial-black">
            Qalara Buyer Directory
          </h2>
          <p className="mt-3 text-sm text-editorial-secondary leading-relaxed max-w-md">
            Search and qualify the buyers Qalara already knows — open a full
            profile and decide whether it&apos;s worth pursuing.
          </p>

          {/* Faux search bar — signals "this is an index you search" */}
          <div className="deck-searchbar mt-6 font-sans">
            <Search size={15} className="text-editorial-accent shrink-0" />
            <span>Search {stats.total.toLocaleString()} buyers…</span>
          </div>

          <div className="mt-5 flex flex-wrap gap-x-2 gap-y-1 text-xs font-code font-medium text-editorial-secondary">
            {SEGMENTS.map((s, i) => (
              <span key={s.key}>
                {s.label}
                {i < SEGMENTS.length - 1 && (
                  <span className="ml-2 text-editorial-muted">·</span>
                )}
              </span>
            ))}
          </div>
        </Link>

        {/* RIGHT — Discovery as a dark radar / terminal */}
        <Link
          href="/discover"
          className="reveal deck-radar group"
          style={{ animationDelay: "180ms" }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Globe size={18} style={{ color: "var(--accent-teal)" }} />
              <span
                className="font-code text-xs font-bold uppercase tracking-widest"
                style={{ color: "#0F766E" }}
              >
                Discovery
              </span>
            </div>
            <ArrowRight
              size={18}
              className="text-editorial-muted transition-transform duration-200 group-hover:translate-x-1"
              style={{ color: "#0F766E" }}
            />
          </div>

          <h2 className="mt-5 font-display font-bold text-2xl lg:text-[1.65rem] text-editorial-black">
            General Discovery
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-editorial-secondary">
            Research any prospective buyer from the web — in or out of the
            database — and build a full profile in seconds.
          </p>

          {/* Terminal prompt + live scan bar */}
          <div className="mt-6 font-code text-xs text-editorial-secondary">
            <span style={{ color: "#0F766E" }}>$</span> analyzing{" "}
            <span className="text-editorial-black font-medium">
              any-company.com
            </span>
            <span className="deck-cursor" />
          </div>
          <div className="deck-scan mt-3" />
          <div className="mt-3 font-code text-[11px] font-semibold uppercase tracking-widest text-editorial-secondary">
            live web research · Claude + DeepSeek
          </div>
        </Link>
      </div>

      {/* Live KPI strip */}
      <div
        className="reveal deck-kpis mt-6"
        style={{ animationDelay: "240ms" }}
      >
        {kpis.map((k) => (
          <div key={k.label} className={`kpi-card ${k.cls}`}>
            <div className="kpi-number">
              {typeof k.n === "number" ? (
                <CountUp value={k.n} />
              ) : (
                k.text
              )}
            </div>
            <div className="kpi-label">{k.label}</div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Classic — the original two-panel magazine layout (for comparison)  */
/* ------------------------------------------------------------------ */
function ClassicLobby() {
  return (
    <div className="mt-12 lg:mt-14 grid gap-6 lg:grid-cols-2">
      <Link
        href="/directory"
        className="reveal entry-panel group"
        style={{ animationDelay: "120ms", ["--accent" as string]: "#4F46E5" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Search size={18} className="text-editorial-accent" />
            <span className="font-code text-xs font-bold uppercase tracking-widest text-editorial-secondary">
              Mode
            </span>
          </div>
          <ArrowRight
            size={18}
            className="text-editorial-muted transition-transform duration-200 group-hover:translate-x-1 group-hover:text-editorial-black"
          />
        </div>
        <h2 className="mt-5 font-display font-bold text-2xl lg:text-[1.65rem] text-editorial-black">
          Qalara Buyer Directory
        </h2>
        <p className="mt-3 text-sm text-editorial-secondary leading-relaxed max-w-md">
          Search and qualify the buyers Qalara already knows. Open a full
          profile and decide whether it&apos;s worth pursuing.
        </p>
        <div className="mt-6 flex flex-wrap gap-x-2 gap-y-1 text-xs font-code font-medium text-editorial-secondary">
          {SEGMENTS.map((s, i) => (
            <span key={s.key}>
              {s.label}
              {i < SEGMENTS.length - 1 && (
                <span className="ml-2 text-editorial-muted">·</span>
              )}
            </span>
          ))}
        </div>
      </Link>

      <Link
        href="/discover"
        className="reveal entry-panel group"
        style={{ animationDelay: "180ms", ["--accent" as string]: "#0D9488" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Globe size={18} style={{ color: "#0D9488" }} />
            <span className="font-code text-xs font-bold uppercase tracking-widest text-editorial-secondary">
              Mode
            </span>
          </div>
          <ArrowRight
            size={18}
            className="text-editorial-muted transition-transform duration-200 group-hover:translate-x-1 group-hover:text-editorial-black"
          />
        </div>
        <h2 className="mt-5 font-display font-bold text-2xl lg:text-[1.65rem] text-editorial-black">
          General Discovery
        </h2>
        <p className="mt-3 text-sm text-editorial-secondary leading-relaxed">
          Research any prospective buyer from the web, in or out of the
          database, and build a full profile in seconds.
        </p>

        {/* Animated terminal + live scan bar */}
        <div className="mt-6 font-code text-xs text-editorial-secondary">
          <span style={{ color: "#0F766E" }}>$</span> analyzing{" "}
          <span className="text-editorial-black font-medium">
            any-company.com
          </span>
          <span className="deck-cursor" />
        </div>
        <div className="deck-scan mt-3" />
        <div className="mt-3 font-code text-[11px] font-semibold uppercase tracking-widest text-editorial-secondary">
          live web research · Claude + DeepSeek
        </div>
      </Link>
    </div>
  );
}
