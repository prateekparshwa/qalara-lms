import Link from "next/link";
import { ArrowRight } from "lucide-react";
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
    <div className="min-h-screen flex flex-col bg-editorial-bg">
      <Masthead subtitle="Qalara Buyer Directory" />

      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-6 lg:px-10 py-10 lg:py-14">
          <h1 className="font-sans font-semibold text-2xl text-editorial-black">
            Choose a segment
          </h1>
          <p className="mt-2 text-sm text-editorial-secondary">
            Each segment is its own list of buyers. Engagement is live now; the
            rest light up as their sheets are linked.
          </p>

          <ul className="mt-8 border-t border-editorial-black">
            {rows.map((r) => {
              const inner = (
                <div className="flex items-center gap-4 py-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                      <span className="font-sans font-semibold text-lg text-editorial-black">
                        {r.label}
                      </span>
                      {r.status === "active" && r.count !== null && (
                        <span className="font-code text-xs text-editorial-muted">
                          {r.count.toLocaleString()}
                        </span>
                      )}
                      {r.status === "coming" && (
                        <span className="seg-status">Coming soon</span>
                      )}
                      {r.status === "deferred" && (
                        <span className="seg-status">Deferred</span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-editorial-muted">
                      {r.definition}
                    </p>
                  </div>
                  {r.status === "active" && (
                    <ArrowRight
                      size={18}
                      className="flex-shrink-0 text-editorial-muted transition-transform duration-200 group-hover:translate-x-1 group-hover:text-editorial-black"
                    />
                  )}
                </div>
              );

              return (
                <li key={r.key} className="border-b border-editorial-border">
                  {r.status === "active" ? (
                    <Link
                      href={`/directory/${r.key}`}
                      className="group block px-1 hover:bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-editorial-accent rounded-sm"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div
                      className="px-1 opacity-60 cursor-not-allowed"
                      title={
                        r.status === "deferred"
                          ? "Order data lives in a separate Buyer Base; planned later."
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
