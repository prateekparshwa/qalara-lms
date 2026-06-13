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
  /** Present when classification/resolution enrichment is requested. */
  enrichment?: {
    type?: string; // "photography" | "graphic" | "wordmark" | "icon" | …
    width?: number;
    height?: number;
  };
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
  // Classification looks at the PIXELS (photography vs sale graphic vs
  // wordmark) — filenames lie. Costs extra credits but decides the board.
  const j = await withKeyFallback((key) =>
    ctxGet(
      "/web/scrape/images",
      {
        url,
        waitForMs: "3000",
        "enrichment[classification]": "true",
        "enrichment[resolution]": "true",
      },
      key
    )
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

export interface CtxFontLink {
  type: string; // "google" | "custom"
  files: Record<string, string>; // weight -> font file URL
  category?: string; // "serif" | "sans-serif" | …
  displayName?: string;
}

export interface CtxTypography {
  /** Heading/display face (from the site's h1). */
  display: { family: string | null; weight: number | null; generic: string | null };
  /** Body face (from the site's p). */
  text: { family: string | null; weight: number | null; generic: string | null };
  fontLinks: Record<string, CtxFontLink>;
}

/** Pull the generic family (serif / sans-serif / …) from a CSS fallback list. */
function genericFromFallbacks(fallbacks: unknown): string | null {
  if (!Array.isArray(fallbacks)) return null;
  for (let i = fallbacks.length - 1; i >= 0; i--) {
    const f = String(fallbacks[i] ?? "").trim().toLowerCase();
    if (/^(serif|sans-serif|monospace|cursive|fantasy|system-ui)$/.test(f)) {
      return f;
    }
  }
  return null;
}

export interface CtxStyleguide {
  colors: { accent?: string; background?: string; text?: string };
  typography: CtxTypography;
}

/**
 * Design system of a site (GET /web/styleguide, 10 credits): real typography
 * from the rendered CSS — heading + body families with font-file URLs — and
 * the site's working colors.
 */
export async function scrapeStyleguide(
  domain: string
): Promise<CtxStyleguide | null> {
  const j = await withKeyFallback((key) =>
    ctxGet("/web/styleguide", { domain }, key)
  );
  const sg = j.styleguide as Record<string, unknown> | undefined;
  if (!sg) return null;
  const typo = (sg.typography ?? {}) as Record<string, unknown>;
  const h1 = ((typo.headings ?? {}) as Record<string, unknown>).h1 as
    | Record<string, unknown>
    | undefined;
  const p = typo.p as Record<string, unknown> | undefined;
  return {
    colors: (sg.colors ?? {}) as CtxStyleguide["colors"],
    typography: {
      display: {
        family: (h1?.fontFamily as string) ?? null,
        weight: (h1?.fontWeight as number) ?? null,
        generic: genericFromFallbacks(h1?.fontFallbacks),
      },
      text: {
        family: (p?.fontFamily as string) ?? null,
        weight: (p?.fontWeight as number) ?? null,
        generic: genericFromFallbacks(p?.fontFallbacks),
      },
      fontLinks: (sg.fontLinks ?? {}) as Record<string, CtxFontLink>,
    },
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
