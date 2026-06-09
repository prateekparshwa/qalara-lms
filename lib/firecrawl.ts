/**
 * Thin Firecrawl helpers (server-only). Both fail soft: on any error they
 * return null/[] so the research pipeline can continue with partial context.
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

export async function firecrawlScrape(
  url: string,
  status?: FirecrawlStatus
): Promise<ScrapeResult | null> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key || !url) return null;
  const full = url.startsWith("http") ? url : `https://${url}`;
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        url: full,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    });
    const j = await res.json();
    if (!res.ok) {
      if (res.status === 402 && status) status.quota = true;
      return null;
    }
    return {
      markdown: j.data?.markdown ?? "",
      metadata: j.data?.metadata ?? {},
    };
  } catch {
    return null;
  }
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
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key || !query) return [];
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ query, limit }),
    });
    const j = await res.json();
    if (!res.ok) {
      if (res.status === 402 && status) status.quota = true;
      return [];
    }
    return (j.data ?? []).map(
      (r: Record<string, unknown>): SearchHit => ({
        title: String(r.title ?? ""),
        url: String(r.url ?? ""),
        description: String(r.description ?? r.snippet ?? ""),
      })
    );
  } catch {
    return [];
  }
}
