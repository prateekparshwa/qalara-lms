interface Stats {
  total: number;
  verified: number;
  highConfidence: number;
  highClassification: number;
}

/**
 * Ledger summary band — a single broadsheet-style line of inline figures, not
 * a row of big-number "hero metric" tiles. Each figure carries its data accent
 * (indigo/teal/amber/rose) at reading scale, followed by the priority-mix bar.
 */
export default function StatsBar({ stats }: { stats: Stats }) {
  const figures = [
    { value: stats.total, label: "leads", color: "#4F46E5" },
    { value: stats.verified, label: "verified sites", color: "#0F766E" },
    { value: stats.highConfidence, label: "high-confidence", color: "#B45309" },
    { value: stats.highClassification, label: "high-priority", color: "#E11D48" },
  ];

  const highShare =
    stats.total > 0 ? (stats.highClassification / stats.total) * 100 : 0;
  const other = Math.max(stats.total - stats.highClassification, 0);

  return (
    <div className="px-6 py-3 border-b border-zinc-200 flex flex-wrap items-center gap-x-6 gap-y-2">
      {figures.map((f, i) => (
        <div key={f.label} className="flex items-center gap-2">
          {i > 0 && (
            <span className="text-editorial-border mr-4" aria-hidden="true">
              /
            </span>
          )}
          <span
            className="font-code font-bold text-base leading-none"
            style={{ color: f.color }}
          >
            {f.value.toLocaleString()}
          </span>
          <span className="text-xs font-sans text-editorial-muted">
            {f.label}
          </span>
        </div>
      ))}

      {stats.total > 0 && (
        <div className="ml-auto flex items-center gap-2.5 min-w-[180px]">
          <div
            className="flex-1 h-1.5 rounded-full overflow-hidden bg-zinc-100 flex"
            role="img"
            aria-label={`${stats.highClassification.toLocaleString()} high-priority buyers of ${stats.total.toLocaleString()} total`}
          >
            <div
              className="h-full"
              style={{
                width: `${Math.max(highShare, 0.5)}%`,
                backgroundColor: "#E11D48",
              }}
            />
          </div>
          <span className="text-[11px] font-code text-editorial-muted whitespace-nowrap">
            <span className="font-semibold" style={{ color: "#E11D48" }}>
              {stats.highClassification.toLocaleString()}
            </span>{" "}
            / {stats.total.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
}
