/**
 * Plain-language definitions for the two graded fields that confuse
 * non-specialist users (buyer priority + website confidence).
 * Single source of truth so badge tooltips and the on-screen legend agree.
 */

export function priorityHint(value: string | null): string {
  if (!value) return "Buyer priority not set.";
  const v = value.toUpperCase();
  if (v.includes("HIGH"))
    return "High-priority buyer — strong potential, worth pursuing first.";
  if (v.includes("MED")) return "Medium-priority buyer.";
  if (v.includes("LOW")) return "Lower-priority buyer.";
  return `Buyer priority: ${value}`;
}

export function webHint(value: string | null): string {
  if (!value) return "Website not yet verified.";
  const v = value.toUpperCase();
  if (v.includes("HIGH")) return "Website verified with high confidence.";
  if (v.includes("MED")) return "Website likely correct (medium confidence).";
  if (v.includes("LOW")) return "Website unverified or low confidence.";
  return `Website confidence: ${value}`;
}

export function customerStatusHint(value: string | null): string {
  if (!value) return "Customer status not set.";
  const v = value.toUpperCase();
  if (v.includes("ACTIVE"))
    return "Active customer — has placed an order recently.";
  if (v.includes("CHURN"))
    return "Churned customer — has ordered before, but not recently.";
  return `Customer status: ${value}`;
}

/** "Active" / "Churned" (from the sheet) -> "Active Customer" / "Churned
 * Customer" for display. Falls back to the raw value for anything else. */
export function customerStatusLabel(value: string | null): string | null {
  if (!value) return null;
  const v = value.trim().toUpperCase();
  if (v.includes("ACTIVE")) return "Active Customer";
  if (v.includes("CHURN")) return "Churned Customer";
  return value;
}

export const PRIORITY_LEGEND: { code: string; desc: string }[] = [
  { code: "HIGH", desc: "Strong potential — pursue first" },
  { code: "MED", desc: "Medium potential" },
  { code: "LOW", desc: "Lower priority" },
];

export const WEB_LEGEND: { code: string; desc: string }[] = [
  { code: "HIGH", desc: "Verified, high confidence" },
  { code: "MED", desc: "Likely correct, medium confidence" },
  { code: "LOW", desc: "Unverified or low confidence" },
];

/** Map a buyer type to a soft color tag class, keyed by what kind of buyer it is. */
export function buyerTypeTag(value: string | null): string {
  if (!value) return "tag-gray";
  const v = value.toLowerCase();
  // Only an unknown / "Not Available" type stays grey — every real type is
  // coloured so the grey clearly signals "no data".
  if (v.includes("not available") || v.includes("n/a") || v.includes("unknown"))
    return "tag-gray";
  if (v.includes("online") || v.includes("commerce") || v.includes("e-com"))
    return "tag-teal";
  if (v.includes("wholesal") || v.includes("distribut")) return "tag-amber";
  if (v.includes("import")) return "tag-violet";
  if (v.includes("interior") || v.includes("design") || v.includes("architect"))
    return "tag-rose";
  if (v.includes("retail") || v.includes("brick") || v.includes("multi"))
    return "tag-indigo";
  if (v.includes("lifestyle") || v.includes("brand") || v.includes("fashion"))
    return "tag-rose";
  // Any other real, named type gets a colour (not grey).
  return "tag-violet";
}
