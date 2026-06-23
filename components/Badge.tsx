import { priorityHint, webHint } from "@/lib/glossary";
import { classificationTier } from "@/lib/format";

type BadgeKind = "priority" | "web";

function grade(value: string): { cls: string; text: string } {
  // Tier is the LEADING word; don't substring-match (the AI rationale text can
  // contain "higher" inside a LOW/MED sentence — see classificationTier).
  const tier = classificationTier(value);
  if (tier === "HIGH") return { cls: "badge-high", text: "HIGH" };
  if (tier === "MEDIUM") return { cls: "badge-medium", text: "MED" };
  if (tier === "LOW") return { cls: "badge-low", text: "LOW" };
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
