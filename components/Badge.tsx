import { priorityHint, webHint, customerStatusHint, customerStatusLabel } from "@/lib/glossary";
import { classificationTier, outreachStatusTone } from "@/lib/format";

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

/** Tailwind classes for the small Outreach Status pill, by tone. Shared by
 * the leads table and the dossier drawer header so both stay in sync. */
const OUTREACH_TONE_CLASSES: Record<ReturnType<typeof outreachStatusTone>, string> = {
  good: "bg-emerald-50 text-emerald-700",
  critical: "bg-red-100 text-red-700",
  warn: "bg-amber-50 text-amber-700",
  neutral: "bg-zinc-100 text-zinc-600",
};

/**
 * Pill for a lead's Outreach Status (the canonical bucket derived from the
 * AM Remark appended to `notes` during the Lead Assignment Sheet apply).
 * Takes the already-computed status text — call `outreachStatus(lead.notes)`
 * first — since not every lead has one.
 */
export function OutreachStatusBadge({ value }: { value: string | null }) {
  if (!value) {
    return <span className="text-editorial-muted text-xs">—</span>;
  }
  const tone = outreachStatusTone(value);
  return (
    <span
      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold whitespace-nowrap ${OUTREACH_TONE_CLASSES[tone]}`}
      title={`Outreach Status — outcome of the AM's follow-up on this lead. ${value}`}
    >
      {value}
    </span>
  );
}
