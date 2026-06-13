import Link from "next/link";
import { ArrowRight, Search, MapPin, Compass } from "lucide-react";
import Masthead from "@/components/Masthead";
import RotatingWord from "@/components/RotatingWord";
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

// Decorative map pins for the hero backdrop (right side); colors cycle the
// 5-accent system, delays stagger the pulse.
const PINS = [
  { top: "14%", left: "80%", color: "#4F46E5", d: "0s" },
  { top: "30%", left: "92%", color: "#0D9488", d: "0.6s" },
  { top: "52%", left: "74%", color: "#F59E0B", d: "1.1s" },
  { top: "64%", left: "88%", color: "#E11D48", d: "1.6s" },
  { top: "40%", left: "63%", color: "#7C3AED", d: "0.9s" },
];

export default async function LobbyPage() {
  let stats: Stats = { total: 0, verified: 0, highConfidence: 0 };
  let lastSynced: string | null = null;
  try {
    // Scope to the engagement directory so the lobby figure matches the
    // dashboard inside (an unscoped count also includes Discovery saves).
    const [s, synced] = await Promise.all([
      getLeadStats("engagement"),
      getLastSynced("engagement"),
    ]);
    stats = {
      total: s.total,
      verified: s.verified,
      highConfidence: s.highConfidence,
    };
    lastSynced = synced;
  } catch {
    // Lobby still renders if the DB is briefly unreachable.
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F4EF] disp-grotesk">
      <Masthead />

      <main className="flex-1 relative overflow-hidden">
        {/* Atlas backdrop: faint map grid + radar sweep + pulsing pins */}
        <div className="atlas-bg" aria-hidden="true" />
        <div
          className="absolute inset-0 z-[1] pointer-events-none hidden sm:block"
          aria-hidden="true"
        >
          <div
            className="atlas-sweep"
            style={{ top: "-70px", right: "-90px", width: "300px", height: "300px" }}
          />
          {PINS.map((p, i) => (
            <span
              key={i}
              className="atlas-pin"
              style={{
                top: p.top,
                left: p.left,
                background: p.color,
                ["--d" as string]: p.d,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-6 lg:px-10 pt-12 lg:pt-16 pb-16">
          {/* Dateline / live signal */}
          <p
            className="reveal text-xs font-code text-editorial-secondary font-semibold tracking-wide"
            style={{ animationDelay: "0ms" }}
          >
            {stats.total.toLocaleString()} buyers mapped ·{" "}
            {stats.verified.toLocaleString()} with a website · last synced{" "}
            {formatSynced(lastSynced)}
          </p>

          <h1
            className="reveal mt-4 font-display font-bold text-4xl lg:text-[3.4rem] leading-[1.1] text-editorial-black"
            style={{ animationDelay: "60ms" }}
          >
            Map every{" "}
            <RotatingWord
              words={["prospect", "lead", "customer"]}
              colors={["#4F46E5", "#0D9488", "#F59E0B"]}
              className="inline-block align-bottom"
              style={{ minWidth: "5.6ch", textAlign: "left" }}
            />
          </h1>
          <p
            className="reveal mt-4 max-w-xl text-base text-editorial-secondary leading-relaxed font-sans"
            style={{ animationDelay: "110ms" }}
          >
            Find a known buyer, or discover a new one. From first signal to
            signed customer, in one place.
          </p>

          {/* Two territories: Directory (known) + Discovery (uncharted) */}
          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            {/* Directory — the known map */}
            <Link
              href="/directory"
              className="reveal atlas-card group"
              style={{ animationDelay: "170ms" }}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <MapPin size={18} style={{ color: "#185FA5" }} />
                  <span className="font-code text-xs font-bold uppercase tracking-widest text-editorial-secondary">
                    Directory
                  </span>
                </div>
                <ArrowRight
                  size={18}
                  className="text-editorial-muted transition-transform duration-200 group-hover:translate-x-1 group-hover:text-editorial-black"
                />
              </div>

              <h2 className="mt-5 font-display font-bold text-2xl lg:text-[1.7rem] text-editorial-black">
                Qalara Buyer Directory
              </h2>
              <p className="mt-3 text-sm text-editorial-secondary leading-relaxed max-w-md font-sans">
                Search and qualify the buyers Qalara already knows. Open a full
                profile and decide whether it&apos;s worth pursuing.
              </p>

              {/* Faux search bar — signals "this is an index you search" */}
              <div className="deck-searchbar mt-6 font-sans">
                <Search size={15} className="shrink-0" style={{ color: "#185FA5" }} />
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

            {/* Discovery — the uncharted territory */}
            <Link
              href="/discover"
              className="reveal atlas-card atlas-card--discover group"
              style={{ animationDelay: "230ms" }}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <Compass size={18} style={{ color: "#3B6D11" }} />
                  <span className="font-code text-xs font-bold uppercase tracking-widest text-editorial-secondary">
                    Discovery
                  </span>
                </div>
                <ArrowRight
                  size={18}
                  className="text-editorial-muted transition-transform duration-200 group-hover:translate-x-1"
                />
              </div>

              <h2 className="mt-5 font-display font-bold text-2xl lg:text-[1.7rem] text-editorial-black">
                General Discovery
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-editorial-secondary font-sans">
                Research any prospective buyer from the web, in or out of the
                database, and build a full profile in seconds.
              </p>

              {/* Terminal prompt + live scan bar */}
              <div className="mt-6 font-code text-xs text-editorial-secondary">
                <span style={{ color: "#3B6D11" }}>$</span> analyzing{" "}
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
        </div>
      </main>
    </div>
  );
}
