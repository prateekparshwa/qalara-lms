/**
 * Thin Firecrawl helpers (server-only). Both fail soft: on any error they
 * return null/[] so the research pipeline can continue with partial context.
 *
 * Key rotation: FIRECRAWL_API_KEY is tried first; when it 402s (out of
 * credits) the same call is retried with FIRECRAWL_API_KEY_BACKUP. `quota`
 * is only reported when every configured key is exhausted.
 */

export interface ScrapeResult {
  markdown: string;
  metadata: Record<string, unknown>;
}

/** Optional out-param: callers that care can learn *why* a call failed soft.
 * `quota` is set true when Firecrawl refuses with 402 (out of credits). */
export interface FirecrawlStatus {
  quota?: boolean;
}

function apiKeys(): string[] {
  return [
    process.env.FIRECRAWL_API_KEY,
    process.env.FIRECRAWL_API_KEY_BACKUP,
  ].filter((k): k is string => !!k && !k.startsWith("your_"));
}

/** POST to a Firecrawl endpoint, rotating across keys on 402. Returns the
 * parsed JSON body, or null after errors/exhaustion of all keys. */
async function firecrawlPost(
  endpoint: string,
  body: Record<string, unknown>,
  status?: FirecrawlStatus
): Promise<Record<string, unknown> | null> {
  const keys = apiKeys();
  for (let i = 0; i < keys.length; i++) {
    try {
      const res = await fetch(`https://api.firecrawl.dev/v1/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${keys[i]}`,
        },
        body: JSON.stringify(body),
      });
      const j = (await res.json()) as Record<string, unknown>;
      if (res.ok) return j;
      if (res.status === 402) {
        if (i === keys.length - 1 && status) status.quota = true;
        continue; // out of credits — try the next key
      }
      console.error(
        `firecrawl ${endpoint} failed (key ${i + 1}/${keys.length}): ${res.status}`,
        JSON.stringify(j).slice(0, 300)
      );
      return null; // non-quota error: don't burn the backup's credits
    } catch (err) {
      console.error(`firecrawl ${endpoint} fetch error:`, err);
      return null;
    }
  }
  return null;
}

export async function firecrawlScrape(
  url: string,
  status?: FirecrawlStatus
): Promise<ScrapeResult | null> {
  if (!url) return null;
  const full = url.startsWith("http") ? url : `https://${url}`;
  const j = await firecrawlPost(
    "scrape",
    { url: full, formats: ["markdown"], onlyMainContent: true },
    status
  );
  if (!j) return null;
  const data = j.data as Record<string, unknown> | undefined;
  return {
    markdown: (data?.markdown as string) ?? "",
    metadata: (data?.metadata as Record<string, unknown>) ?? {},
  };
}

export interface SearchHit {
  title: string;
  url: string;
  description: string;
}

export async function firecrawlSearch(
  query: string,
  limit = 5,
  status?: FirecrawlStatus
): Promise<SearchHit[]> {
  if (!query) return [];
  const j = await firecrawlPost("search", { query, limit }, status);
  if (!j) return [];
  return ((j.data as Record<string, unknown>[]) ?? []).map(
    (r): SearchHit => ({
      title: String(r.title ?? ""),
      url: String(r.url ?? ""),
      description: String(r.description ?? r.snippet ?? ""),
    })
  );
}
