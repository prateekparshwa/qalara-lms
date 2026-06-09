/**
 * Thin Firecrawl helpers (server-only). Both fail soft: on any error they
 * return null/[] so the research pipeline can continue with partial context.
 */

export interface ScrapeResult {
  markdown: string;
  metadata: Record<string, unknown>;
}

export async function firecrawlScrape(
  url: string
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
    if (!res.ok) return null;
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
  limit = 5
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
    if (!res.ok) return [];
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
