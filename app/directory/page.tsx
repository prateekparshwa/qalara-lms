import Link from "next/link";
import { ArrowRight, ArrowLeft } from "lucide-react";
import Masthead from "@/components/Masthead";
import AtlasBackdrop from "@/components/AtlasBackdrop";
import DirectorySearch from "@/components/DirectorySearch";
import TrackerSyncPanel from "@/components/TrackerSyncPanel";
import { SEGMENTS, segmentSpreadsheetId } from "@/lib/segments";
import { getLeadStats } from "@/lib/leads";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Row = {
  key: string;
  label: string;
  definition: string;
  status: "active" | "coming" | "deferred";
  count: number | null;
};

export default async function DirectoryPage() {
  const rows: Row[] = await Promise.all(
    SEGMENTS.map(async (s): Promise<Row> => {
      const linked = !!segmentSpreadsheetId(s);
      const status: Row["status"] = s.deferred
        ? "deferred"
        : linked
        ? "active"
        : "coming";
      let count: number | null = null;
      if (status === "active") {
        try {
          count = (await getLeadStats(s.key)).total;
        } catch {
          count = null;
        }
      }
      return {
        key: s.key,
        label: s.label,
        definition: s.definition,
        status,
        count,
      };
    })
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F4EF] disp-grotesk">
      <Masthead subtitle="Qalara Buyer Directory" />

      <main className="flex-1 relative overflow-hidden">
        <AtlasBackdrop />

        <div className="relative z-10 max-w-[90rem] mx-auto px-6 lg:px-10 py-4 lg:py-6">
          {/* Breadcrumb back to the lobby */}
          <Link
            href="/"
            className="group inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-white/70 px-3 py-1.5 text-xs font-code font-bold text-editorial-black hover:border-editorial-black hover:bg-white transition-colors"
          >
            <ArrowLeft
              size={14}
              className="transition-transform duration-200 group-hover:-translate-x-0.5"
            />
            Lobby
          </Link>

          <h1 className="mt-3 font-display font-bold text-2xl lg:text-3xl text-editorial-black">
            Choose a segment
          </h1>
          <p className="mt-1.5 text-sm text-editorial-secondary font-sans max-w-xl">
            Each segment is its own list of buyers — or search directly if you
            already know the buyer.
          </p>

          <div className="mt-5 grid grid-cols-1 lg:grid-cols-[1fr_1.3fr] gap-6 lg:gap-8 items-start">
            <div className="lg:pr-6 lg:border-r lg:border-editorial-black">
              <ul className="border-t border-b border-editorial-black">
                {rows.map((r) => {
                  const inner = (
                    <div className="flex items-center gap-4 py-3.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2.5">
                          <span className="font-display font-semibold text-lg text-editorial-black">
                            {r.label}
                          </span>
                          {r.status === "coming" && (
                            <span className="seg-status">Coming soon</span>
                          )}
                          {r.status === "deferred" && (
                            <span className="seg-status">Deferred</span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-editorial-muted font-sans">
                          {r.definition}
                        </p>
                      </div>

                      {/* Right cluster: ledger count + chevron for live segments */}
                      {r.status === "active" && (
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {r.count !== null && (
                            <span className="font-code text-sm font-semibold text-editorial-black tabular-nums">
                              {r.count.toLocaleString()}
                            </span>
                          )}
                          <ArrowRight
                            size={18}
                            className="text-editorial-muted transition-transform duration-200 group-hover:translate-x-1 group-hover:text-editorial-black"
                          />
                        </div>
                      )}
                    </div>
                  );

                  return (
                    <li key={r.key} className="border-b border-editorial-border">
                      {r.status === "active" ? (
                        <Link
                          href={`/directory/${r.key}`}
                          className="group block hover:bg-white/70 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-editorial-accent"
                        >
                          {inner}
                        </Link>
                      ) : (
                        <div
                          className="opacity-55 cursor-not-allowed"
                          title={
                            r.status === "deferred"
                              ? "Planned for a later phase."
                              : "Link this segment's Google Sheet to enable it."
                          }
                          aria-disabled="true"
                        >
                          {inner}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            <DirectorySearch />
          </div>

          <TrackerSyncPanel />
        </div>
      </main>
    </div>
  );
}
