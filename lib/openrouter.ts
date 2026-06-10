/**
 * Minimal OpenRouter chat client (server-only).
 *
 * Model defaults to the free Llama 3.3 70B; override with OPENROUTER_MODEL.
 */

const DEFAULT_MODEL = "anthropic/claude-haiku-4.5";

// Fallback chain — if the primary provider errors, OpenRouter tries the next.
// DeepSeek (paid, reliable) is the main backup; a free model is the last resort.
const FALLBACKS = [
  "deepseek/deepseek-v4-flash",
  "qwen/qwen3.6-plus:free",
];

export interface CompleteOptions {
  /** Enable OpenRouter's web-search plugin (engine configured on the
   * OpenRouter account — currently Firecrawl). The model searches the web
   * itself; results are consumed in-context. */
  webSearch?: boolean;
  /** Override the primary model (full OpenRouter id); the standard fallback
   * chain still applies after it. */
  model?: string;
}

async function once(
  key: string,
  models: string[],
  system: string,
  user: string,
  opts?: CompleteOptions
): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "HTTP-Referer": "https://qalara-lms.vercel.app",
      "X-Title": "Qalara LMS",
    },
    body: JSON.stringify({
      models, // OpenRouter falls through this list on provider errors
      ...(opts?.webSearch
        ? { plugins: [{ id: "web", max_results: 5 }] }
        : {}),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.2,
    }),
  });

  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      j?.error?.message || `OpenRouter request failed (${res.status}).`
    );
  }
  const content = j?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("OpenRouter returned an empty response.");
  }
  return content;
}

export async function openrouterComplete(
  system: string,
  user: string,
  opts?: CompleteOptions
): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key || !key.trim()) {
    throw new Error("OPENROUTER_API_KEY is not set.");
  }
  const primary =
    opts?.model || process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  // OpenRouter allows at most 3 models in the fallback array.
  const models = Array.from(
    new Set([primary, DEFAULT_MODEL, ...FALLBACKS])
  ).slice(0, 3);

  // One retry across the whole fallback chain for transient provider errors.
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await once(key, models, system, user, opts);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("OpenRouter request failed.");
}

/** Extract the first JSON object from a model response (tolerates code fences / prose). */
export function parseJsonLoose(text: string): Record<string, unknown> {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("The model did not return JSON.");
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}
