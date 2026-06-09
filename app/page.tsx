import Link from "next/link";
import { ArrowRight, Search, Globe } from "lucide-react";
import Masthead from "@/components/Masthead";
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

export default async function LobbyPage() {
  let total = 0;
  let lastSynced: string | null = null;
  try {
    const [stats, synced] = await Promise.all([
      getLeadStats(),
      getLastSynced(),
    ]);
    total = stats.total;
    lastSynced = synced;
  } catch {
    // Lobby still renders if the DB is briefly unreachable.
  }

  return (
    <div className="min-h-screen flex flex-col bg-editorial-bg">
      <Masthead />

      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-10 lg:py-16">
          {/* Dateline / live signal */}
          <p
            className="reveal text-xs font-code text-editorial-muted tracking-wide"
            style={{ animationDelay: "0ms" }}
          >
            {total.toLocaleString()} buyers in the database · last synced{" "}
            {formatSynced(lastSynced)}
          </p>

          <h1
            className="reveal mt-3 max-w-2xl font-sans font-semibold text-3xl lg:text-4xl leading-tight text-editorial-black text-balance"
            style={{ animationDelay: "60ms" }}
          >
            Find a known buyer, or discover a new one.
          </h1>

          {/* Two asymmetric entry panels */}
          <div className="mt-10 grid gap-5 lg:grid-cols-5">
            {/* Qalara Buyer Directory — primary, wider */}
            <Link
              href="/directory"
              className="reveal entry-panel group lg:col-span-3"
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
              <h2 className="mt-5 font-sans font-semibold text-2xl text-editorial-black">
                Qalara Buyer Directory
              </h2>
              <p className="mt-2 text-sm text-editorial-secondary leading-relaxed max-w-md">
                Search and qualify the buyers Qalara already knows. Open a full
                profile and decide whether it&apos;s worth pursuing.
              </p>
              <div className="mt-6 flex flex-wrap gap-x-2 gap-y-1 text-xs font-code text-editorial-muted">
                {SEGMENTS.map((s, i) => (
                  <span key={s.key}>
                    {s.label}
                    {i < SEGMENTS.length - 1 && (
                      <span className="ml-2 text-editorial-border">·</span>
                    )}
                  </span>
                ))}
              </div>
            </Link>

            {/* General Discovery — secondary, narrower */}
            <Link
              href="/discover"
              className="reveal entry-panel group lg:col-span-2"
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
              <h2 className="mt-5 font-sans font-semibold text-2xl text-editorial-black">
                General Discovery
              </h2>
              <p className="mt-2 text-sm text-editorial-secondary leading-relaxed">
                Research any prospective buyer from the web, in or out of the
                database, and build a full profile in seconds.
              </p>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
