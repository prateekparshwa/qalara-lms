interface Stats {
  total: number;
  verified: number;
  highConfidence: number;
  highClassification: number;
  amAssigned?: number;
  /** ISO timestamp of the most recent sheet sync. */
  lastSynced?: string | null;
}

/** "2026-06-12T08:15:00Z" -> "12 Jun 2026, 1:45 pm IST". */
function formatIst(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return (
    new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d) + " IST"
  );
}

export default function StatsBar({ stats }: { stats: Stats }) {
  const figures = [
    { value: stats.total, label: "leads", color: "#4F46E5" },
    { value: stats.verified, label: "verified sites", color: "#0F766E" },
    { value: stats.highClassification, label: "high-priority", color: "#E11D48" },
  ];

  const amAssigned = stats.amAssigned ?? 0;
  const amShare = stats.total > 0 ? (amAssigned / stats.total) * 100 : 0;
  const synced = formatIst(stats.lastSynced);

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

      {synced && (
        <span className="text-[11px] font-code text-editorial-muted whitespace-nowrap">
          Last synced: {synced}
        </span>
      )}

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
