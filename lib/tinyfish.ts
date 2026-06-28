/**
 * TinyFish REST helpers (server-side only).
 *
 * Search and Fetch are TinyFish's free endpoints:
 *   Search: GET  https://api.search.tinyfish.ai?query=...
 *   Fetch:  POST https://api.fetch.tinyfish.ai   { urls, format }
 * Both authenticate with the `X-API-Key` header.
 *
 * Env: TINYFISH_API_KEY (also accepts the legacy name TINYFISH).
 */

const SEARCH_ENDPOINT = "https://api.search.tinyfish.ai";
const FETCH_ENDPOINT = "https://api.fetch.tinyfish.ai";

function apiKey(): string {
  const key = process.env.TINYFISH_API_KEY || process.env.TINYFISH || "";
  if (!key.trim()) {
    throw new Error(
      "TINYFISH_API_KEY is not set. Add it to the environment to enable TinyFish lookups."
    );
  }
  return key.trim();
}

export interface TinyfishSearchResult {
  position?: number;
  site_name?: string;
  title?: string;
  snippet?: string;
  url?: string;
}

export interface TinyfishSearchResponse {
  query: string;
  results: TinyfishSearchResult[];
  total_results?: number;
  page?: number;
}

export async function tinyfishSearch(
  query: string,
  opts?: { location?: string; language?: string; page?: number }
): Promise<TinyfishSearchResponse> {
  const params = new URLSearchParams({ query });
  if (opts?.location) params.set("location", opts.location);
  if (opts?.language) params.set("language", opts.language);
  if (opts?.page != null) params.set("page", String(opts.page));

  const res = await fetch(`${SEARCH_ENDPOINT}?${params.toString()}`, {
    headers: { "X-API-Key": apiKey() },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `TinyFish search failed (${res.status})${body ? `: ${body.slice(0, 200)}` : ""}`
    );
  }
  return res.json();
}

export interface TinyfishFetchPage {
  url: string;
  final_url?: string;
  title?: string;
  description?: string;
  language?: string;
  format?: string;
  text?: string;
}

export interface TinyfishFetchResponse {
  results: TinyfishFetchPage[];
  errors: { url: string; error: string; status?: number }[];
}

export async function tinyfishFetch(
  urls: string[],
  opts?: { format?: "markdown" | "html" | "json"; ttl?: number }
): Promise<TinyfishFetchResponse> {
  const res = await fetch(FETCH_ENDPOINT, {
    method: "POST",
    headers: { "X-API-Key": apiKey(), "Content-Type": "application/json" },
    body: JSON.stringify({
      urls,
      format: opts?.format ?? "markdown",
      ...(opts?.ttl != null ? { ttl: opts.ttl } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `TinyFish fetch failed (${res.status})${body ? `: ${body.slice(0, 200)}` : ""}`
    );
  }
  return res.json();
}
