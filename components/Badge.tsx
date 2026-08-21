import { priorityHint, webHint, customerStatusHint, customerStatusLabel } from "@/lib/glossary";
import { classificationTier } from "@/lib/format";

type BadgeKind = "priority" | "web" | "customerStatus";

function grade(value: string): { cls: string; text: string } {
  // Tier is the LEADING word; don't substring-match (the AI rationale text can
  // contain "higher" inside a LOW/MED sentence — see classificationTier).
  const tier = classificationTier(value);
  if (tier === "HIGH") return { cls: "badge-high", text: "HIGH" };
  if (tier === "MEDIUM") return { cls: "badge-medium", text: "MED" };
  if (tier === "LOW") return { cls: "badge-low", text: "LOW" };
  return { cls: "badge-unverified", text: value.slice(0, 8).toUpperCase() };
}

/** Active = green (good), Churned = rose (lost), anything else = neutral. */
function customerStatusGrade(value: string): { cls: string; text: string } {
  const v = value.trim().toUpperCase();
  const text = customerStatusLabel(value) ?? value;
  if (v.includes("ACTIVE")) return { cls: "badge-high", text };
  if (v.includes("CHURN")) return { cls: "badge-low", text };
  return { cls: "badge-unverified", text };
}

/**
 * The single graded-value badge used everywhere (table + drawer) for buyer
 * priority, website confidence, and customer status. One shape, semantic
 * color by grade, plain-language tooltip from the shared glossary.
 */
export default function Badge({
  value,
  kind,
}: {
  value: string | null;
  kind: BadgeKind;
}) {
  const hint =
    kind === "priority"
      ? priorityHint(value)
      : kind === "customerStatus"
      ? customerStatusHint(value)
      : webHint(value);
  if (!value) {
    return (
      <span className="text-editorial-muted text-xs" title={hint} aria-label={hint}>
        —
      </span>
    );
  }
  const { cls, text } =
    kind === "customerStatus" ? customerStatusGrade(value) : grade(value);
  return (
    <span className={`badge ${cls}`} title={hint} aria-label={hint}>
      {text}
    </span>
  );
}
