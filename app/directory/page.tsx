import Link from "next/link";
import { ArrowRight, ArrowLeft } from "lucide-react";
import Masthead from "@/components/Masthead";
import { SEGMENTS, segmentSpreadsheetId } from "@/lib/segments";
import { getLeadStats } from "@/lib/leads";

export const dynamic = "force-dynamic";

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
    <div className="min-h-screen flex flex-col bg-editorial-bg disp-grotesk">
      <Masthead subtitle="Qalara Buyer Directory" />

      <main className="flex-1 relative overflow-hidden">
        <div className="atlas-bg" aria-hidden="true" />

        <div className="relative z-10 max-w-3xl mx-auto px-6 lg:px-10 py-10 lg:py-14">
          {/* Breadcrumb back to the lobby */}
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-code text-editorial-secondary hover:text-editorial-black transition-colors group"
          >
            <ArrowLeft
              size={13}
              className="transition-transform duration-200 group-hover:-translate-x-0.5"
            />
            Lobby
          </Link>

          <h1 className="mt-5 font-display font-bold text-3xl text-editorial-black">
            Choose a segment
          </h1>
          <p className="mt-2 text-sm text-editorial-secondary font-sans max-w-xl">
            Each segment is its own list of buyers. Engagement is live now; the
            rest light up as their sheets are linked.
          </p>

          <ul className="mt-8 border-t border-editorial-black">
            {rows.map((r) => {
              const inner = (
                <div className="flex items-center gap-4 py-5">
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
                      className="group block px-2 -mx-2 rounded-md hover:bg-white/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-editorial-accent"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div
                      className="px-2 -mx-2 opacity-55 cursor-not-allowed"
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
      </main>
    </div>
  );
}
