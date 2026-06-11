interface Stats {
  total: number;
  verified: number;
  highConfidence: number;
  highClassification: number;
  amAssigned?: number;
}

export default function StatsBar({ stats }: { stats: Stats }) {
  const figures = [
    { value: stats.total, label: "leads", color: "#4F46E5" },
    { value: stats.verified, label: "verified sites", color: "#0F766E" },
    { value: stats.highConfidence, label: "high-confidence", color: "#B45309" },
    { value: stats.highClassification, label: "high-priority", color: "#E11D48" },
  ];

  const amAssigned = stats.amAssigned ?? 0;
  const amShare = stats.total > 0 ? (amAssigned / stats.total) * 100 : 0;

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
        <div className="ml-auto flex items-center gap-2.5 min-w-[200px]">
          <span className="text-[10px] font-code text-editorial-muted whitespace-nowrap">
            AM assigned
          </span>
          <div
            className="flex-1 h-1.5 rounded-full overflow-hidden bg-zinc-100"
            role="img"
            aria-label={`${amAssigned.toLocaleString()} leads with AM assigned out of ${stats.total.toLocaleString()} total`}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(amShare, 0.5)}%`,
                backgroundColor: "#7C3AED",
              }}
            />
          </div>
          <span className="text-[11px] font-code text-editorial-muted whitespace-nowrap">
            <span className="font-semibold" style={{ color: "#7C3AED" }}>
              {amAssigned.toLocaleString()}
            </span>{" "}
            / {stats.total.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
}
