/**
 * Minimal OpenRouter chat client (server-only).
 *
 * Model defaults to the free Llama 3.3 70B; override with OPENROUTER_MODEL.
 */

const DEFAULT_MODEL = "qwen/qwen3.6-plus:free";

// Free-model fallback chain — if one provider errors, OpenRouter tries the next.
const FREE_FALLBACKS = [
  "qwen/qwen3.6-plus:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-4-31b-it:free",
  "qwen/qwen3-coder:free",
];

async function once(
  key: string,
  models: string[],
  system: string,
  user: string
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
  user: string
): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key || !key.trim()) {
    throw new Error("OPENROUTER_API_KEY is not set.");
  }
  const primary = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  // OpenRouter allows at most 3 models in the fallback array.
  const models = Array.from(new Set([primary, ...FREE_FALLBACKS])).slice(0, 3);

  // One retry across the whole fallback chain for transient provider errors.
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await once(key, models, system, user);
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
