import { priorityHint, webHint } from "@/lib/glossary";

type BadgeKind = "priority" | "web";

function grade(value: string): { cls: string; text: string } {
  const v = value.toUpperCase();
  if (v.includes("HIGH")) return { cls: "badge-high", text: "HIGH" };
  if (v.includes("MED")) return { cls: "badge-medium", text: "MED" };
  if (v.includes("LOW")) return { cls: "badge-low", text: "LOW" };
  return { cls: "badge-unverified", text: value.slice(0, 8).toUpperCase() };
}

/**
 * The single graded-value badge used everywhere (table + drawer) for both
 * buyer priority and website confidence. One shape, semantic color by grade,
 * plain-language tooltip from the shared glossary.
 */
export default function Badge({
  value,
  kind,
}: {
  value: string | null;
  kind: BadgeKind;
}) {
  const hint = kind === "priority" ? priorityHint(value) : webHint(value);
  if (!value) {
    return (
      <span className="text-editorial-muted text-xs" title={hint} aria-label={hint}>
        —
      </span>
    );
  }
  const { cls, text } = grade(value);
  return (
    <span className={`badge ${cls}`} title={hint} aria-label={hint}>
      {text}
    </span>
  );
}
