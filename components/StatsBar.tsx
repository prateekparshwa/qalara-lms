interface Stats {
  total: number;
  verified: number;
  highConfidence: number;
  highClassification: number;
}

export default function StatsBar({ stats }: { stats: Stats }) {
  const cards = [
    {
      number: stats.total.toLocaleString(),
      label: "Total Leads",
      hint: "All buyer leads in the database.",
      color: "kpi-indigo",
    },
    {
      number: stats.verified.toLocaleString(),
      label: "Verified Websites",
      hint: "Leads with a confirmed website.",
      color: "kpi-teal",
    },
    {
      number: stats.highConfidence.toLocaleString(),
      label: "High-Conf. Sites",
      hint: "Websites verified with HIGH confidence.",
      color: "kpi-amber",
    },
    {
      number: stats.highClassification.toLocaleString(),
      label: "High-Priority Buyers",
      hint: "Buyers classified as HIGH priority.",
      color: "kpi-rose",
    },
  ];

  const highShare = stats.total > 0 ? (stats.highClassification / stats.total) * 100 : 0;
  const other = Math.max(stats.total - stats.highClassification, 0);

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 border-b border-zinc-200">
        {cards.map((card, i) => (
          <div
            key={card.label}
            title={card.hint}
            className={`kpi-card ${card.color} px-6 ${
              i < cards.length - 1 ? "border-r border-zinc-200" : ""
            }`}
          >
            <div className="kpi-number">{card.number}</div>
            <div className="kpi-label">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Priority mix proportion bar */}
      {stats.total > 0 && (
        <div className="px-6 py-2.5 border-b border-zinc-200 flex items-center gap-3">
          <span className="text-[10px] font-code font-bold uppercase tracking-widest text-editorial-muted whitespace-nowrap">
            Priority mix
          </span>
          <div
            className="flex-1 h-2 rounded-full overflow-hidden bg-zinc-100 flex"
            role="img"
            aria-label={`${stats.highClassification.toLocaleString()} high-priority buyers out of ${stats.total.toLocaleString()} total`}
          >
            <div
              className="h-full bg-accent-rose"
              style={{ width: `${Math.max(highShare, 0.5)}%` }}
            />
          </div>
          <span className="text-[10px] font-code text-editorial-muted whitespace-nowrap">
            <span className="text-accent-rose font-semibold">
              {stats.highClassification.toLocaleString()} HIGH
            </span>{" "}
            · {other.toLocaleString()} other
          </span>
        </div>
      )}
    </>
  );
}
