/**
 * Condense a pulled email into a short gist for the dossier's
 * "Last Email Summary" field. Runs on the cheap/fast model (Haiku via
 * OpenRouter); on any failure it falls back to a trimmed excerpt so the field
 * is never worse than a plain truncation.
 */
import { openrouterComplete } from "./openrouter";

const SYSTEM =
  "You summarise a single sales email for a CRM's activity log. Output 3-4 " +
  "short lines, plain text, no preamble. Say who reached out to whom and the " +
  "core point (offer, categories, ask). If the email implies a clear next " +
  "step, end with a final line starting 'Action: '. No greetings, no " +
  "sign-off, no markdown.";

/** Naive fallback: first ~3 sentences / 320 chars, greeting line dropped. */
export function excerptFallback(body: string): string {
  const clean = body
    .replace(/^\s*\d{4}-\d{2}-\d{2}\s*[—-]\s*/, "")
    .replace(/^(hi|hello|dear)\b[^\n]*\n+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length <= 320) return clean;
  const cut = clean.slice(0, 320);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return (lastStop > 120 ? cut.slice(0, lastStop + 1) : cut) + "…";
}

export async function gistEmail(
  subject: string | null,
  body: string | null
): Promise<{ gist: string; usedFallback: boolean }> {
  const text = (body ?? "").trim();
  if (!text) return { gist: "", usedFallback: true };
  // Already short — nothing to gain from a model call.
  if (text.replace(/^\s*\d{4}-\d{2}-\d{2}\s*[—-]\s*/, "").length <= 300) {
    return { gist: excerptFallback(text), usedFallback: true };
  }
  try {
    const user =
      `Subject: ${subject ?? "(none)"}\n\n` +
      // Cap the input so one runaway thread can't balloon a call.
      text.slice(0, 6000);
    const out = (await openrouterComplete(SYSTEM, user)).trim();
    if (!out) return { gist: excerptFallback(text), usedFallback: true };
    return { gist: out, usedFallback: false };
  } catch {
    return { gist: excerptFallback(text), usedFallback: true };
  }
}

/** Run `fn` over `items` with at most `concurrency` in flight. */
export async function mapLimit<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );
  return results;
}
