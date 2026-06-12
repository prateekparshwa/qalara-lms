/**
 * context.dev helper (server-only) — visual/brand intelligence for moodboards.
 *
 * Two endpoints are used:
 *   GET /v1/web/scrape/images  — every image on a page (src, alt, element type)
 *   GET /v1/brand/retrieve     — logo, brand colors, description, socials by domain
 *
 * Primary key first; CONTEXT_DEV_API_KEY_BACKUP takes over when the primary
 * errors (rate limit / credit exhaustion), mirroring the Hunter fallback.
 */

const BASE = "https://api.context.dev/v1";

export interface CtxImage {
  src: string;
  alt: string | null;
  element?: string;
  type?: string;
}

export interface CtxBrandColor {
  hex: string;
  name?: string;
}

export interface CtxBrandLogo {
  url: string;
  mode?: string;
  type?: string;
}

export interface CtxBrand {
  title: string | null;
  description: string | null;
  slogan: string | null;
  colors: CtxBrandColor[];
  logos: CtxBrandLogo[];
  socials: { type: string; url: string }[];
}

function apiKeys(): string[] {
  return [
    process.env.CONTEXT_DEV_API_KEY,
    process.env.CONTEXT_DEV_API_KEY_BACKUP,
  ].filter((k): k is string => Boolean(k));
}

async function ctxGet(
  path: string,
  params: Record<string, string>,
  key: string
): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE}${path}?${qs}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || j.error_code) {
    const msg = j.message || j.error_code || `context.dev ${res.status}`;
    throw new Error(String(msg));
  }
  return j;
}

/** Run a context.dev call with primary→backup key fallback. */
async function withKeyFallback<T>(
  fn: (key: string) => Promise<T>
): Promise<T> {
  const keys = apiKeys();
  if (keys.length === 0) {
    throw new Error("CONTEXT_DEV_API_KEY is not configured.");
  }
  let lastErr: unknown = null;
  for (const key of keys) {
    try {
      return await fn(key);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

/**
 * All images on a page. Sites that block headless browsers return an empty
 * list or a WEBSITE_ACCESS_ERROR — callers should treat both as "no images"
 * and fall back to a screenshot.
 */
export async function scrapeImages(url: string): Promise<CtxImage[]> {
  const j = await withKeyFallback((key) =>
    ctxGet("/web/scrape/images", { url, waitForMs: "3000" }, key)
  );
  const images = (j.images ?? []) as CtxImage[];
  return images;
}

/** Brand identity (logo, colors, description, socials) by bare domain. */
export async function brandRetrieve(domain: string): Promise<CtxBrand | null> {
  const j = await withKeyFallback((key) =>
    ctxGet("/brand/retrieve", { domain }, key)
  );
  const b = j.brand as Record<string, unknown> | undefined;
  if (!b) return null;
  return {
    title: (b.title as string) ?? null,
    description: (b.description as string) ?? null,
    slogan: (b.slogan as string) ?? null,
    colors: ((b.colors ?? []) as CtxBrandColor[]).filter((c) => c?.hex),
    logos: ((b.logos ?? []) as CtxBrandLogo[]).filter((l) => l?.url),
    socials: ((b.socials ?? []) as { type: string; url: string }[]).filter(
      (s) => s?.url
    ),
  };
}

/** Strip a URL down to the bare domain context.dev's brand API expects. */
export function bareDomain(url: string): string {
  return url
    .replace(/^https?:\/\/(www\.)?/i, "")
    .replace(/\/.*$/, "")
    .trim()
    .toLowerCase();
}
