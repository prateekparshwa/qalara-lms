"use client";

import { useEffect, useState } from "react";
import { ChevronRight, FileDown, Loader2, Palette, RefreshCw, X } from "lucide-react";
import type { Lead } from "@/lib/leads";
import { downloadMoodboardPdf, MoodboardPdfData } from "@/lib/moodboardPdf";

/**
 * "Moodboard" — an editorial board of the buyer's visual identity, built on
 * demand from their website. The board contract lives in MOODBOARD.md —
 * change both together.
 *
 * The dossier carries only a launcher button; the board itself opens in a
 * full-height panel on the LEFT (the dossier drawer stays on the right), with
 * Regenerate / Download PDF / Close in its header. First open builds the
 * board; afterwards it's served from a 7-day server-side cache.
 */

const BOARD_VERSION = 4; // must match app/api/enrich/moodboard/route.ts

interface TypographyFace {
  name: string | null;
  category: string | null;
  files: Record<string, string>;
}

interface MoodboardData {
  version?: number;
  brand: {
    title: string | null;
    description: string | null;
    slogan: string | null;
    colors: { hex: string; name?: string }[];
    logos: { url: string; mode?: string; type?: string }[];
    socials: { type: string; url: string }[];
  } | null;
  images: { src: string; alt: string | null; label?: string | null }[];
  screenshot: string | null;
  editorial: {
    quote: { text: string; type: "slogan" | "essence" } | null;
    dateline: string | null;
    aesthetic: string | null;
    voiceKeywords: string[];
    programs: string[];
    palette: { hex: string; name: string }[];
    displaySample: string | null;
  } | null;
  typography: {
    display: TypographyFace;
    text: TypographyFace;
  } | null;
  fetchedAt: string;
}

/** Font names come from an external API — keep only safe identifier chars. */
function safeFontName(name: string): string {
  return name.replace(/[^A-Za-z0-9 _-]/g, "").trim();
}

/** @font-face rules so type samples render in the buyer's REAL typefaces.
 * Injected via a <style> tag, so every value is strictly whitelisted:
 * names reduced to [A-Za-z0-9 _-], URLs and weights pattern-matched. */
function fontFaceCss(typography: MoodboardData["typography"]): string {
  if (!typography) return "";
  const rules: string[] = [];
  for (const face of [typography.display, typography.text]) {
    const name = face?.name ? safeFontName(face.name) : "";
    if (!name) continue;
    for (const [weight, url] of Object.entries(face.files)) {
      if (!/^https:\/\/[A-Za-z0-9._~:/?#@!$&*+,;=%()-]+$/.test(url)) continue;
      if (!/^\d{3}$/.test(weight)) continue;
      rules.push(
        `@font-face{font-family:'mb-${name}';src:url('${url}');font-weight:${weight};font-display:swap;}`
      );
    }
  }
  return rules.join("\n");
}

/** CSS stack: the loaded brand face first, category fallback after. */
function faceStack(face: TypographyFace | undefined | null): string {
  const fallback =
    face?.category && /serif/i.test(face.category) && !/sans/i.test(face.category)
      ? "Georgia, serif"
      : "Helvetica, Arial, sans-serif";
  const name = face?.name ? safeFontName(face.name) : "";
  return name && face && Object.keys(face.files).length > 0
    ? `'mb-${name}', ${fallback}`
    : fallback;
}

function luminance(hex: string): number {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function contrastText(hex: string): string {
  return luminance(hex) > 150 ? "#18181b" : "#fafaf9";
}

/** Board canvas: the palette's lightest WARM paper tone, else light amber —
 * never plain white (MOODBOARD.md §8). */
const AMBER_PAPER = "#FBF4E6";
function paperTone(palette: { hex: string }[]): string {
  const light = palette
    .filter((c) => luminance(c.hex) > 215 && luminance(c.hex) < 250)
    .sort((a, b) => luminance(b.hex) - luminance(a.hex))[0];
  return light?.hex ?? AMBER_PAPER;
}

export default function Moodboard({ lead }: { lead: Lead }) {
  const initial =
    (lead.enrichment_cache?.moodboard as MoodboardData | undefined) ?? null;
  // Boards from older contract versions rebuild on open.
  const [data, setData] = useState<MoodboardData | null>(
    initial?.version === BOARD_VERSION ? initial : null
  );
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState<Set<string>>(new Set());

  const website = (lead.website ?? "").trim();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!website) return null;

  const generate = async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/enrich/moodboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id, url: website, force }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error ?? "Moodboard failed");
      } else {
        setData(j.result as MoodboardData);
        setFailed(new Set());
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const openBoard = () => {
    setOpen(true);
    if (!data && !loading) void generate();
  };

  const exportPdf = async () => {
    if (!data) return;
    setExporting(true);
    try {
      const pdfData: MoodboardPdfData = {
        organization: lead.organization,
        website,
        brand: data.brand,
        images: (data.images ?? []).filter((i) => !failed.has(i.src)),
        screenshot: data.screenshot,
        editorial: data.editorial,
        typography: data.typography,
        fetchedAt: data.fetchedAt,
      };
      await downloadMoodboardPdf(pdfData);
    } finally {
      setExporting(false);
    }
  };

  const logo = data?.brand?.logos?.[0]?.url ?? null;
  const palette = data?.editorial?.palette?.length
    ? data.editorial.palette
    : (data?.brand?.colors ?? []).map((c) => ({
        hex: c.hex,
        name: c.name ?? c.hex,
      }));
  const accent =
    palette.filter((c) => luminance(c.hex) <= 215)[0]?.hex ?? "#18181b";
  const paper = paperTone(palette);
  const images = (data?.images ?? []).filter((i) => !failed.has(i.src));
  const hero = images[0] ?? null;
  const rest = images.slice(1);
  // Quote panel sourcing (MOODBOARD.md §3): REAL words only — a verified
  // verbatim quote, else the official slogan, else nothing. Never fabricated.
  const quote =
    data?.editorial?.quote ??
    (data?.brand?.slogan
      ? { text: data.brand.slogan, type: "slogan" as const }
      : null);
  const orgName = data?.brand?.title ?? lead.organization ?? "Buyer";
  const imgLabel = (img: { alt: string | null; label?: string | null }) => {
    const l = img.label ?? img.alt;
    return l && !/^https?:\/\//i.test(l) ? l : null; // hide raw URL labels
  };

  return (
    <>
      {/* ── Dossier launcher ─────────────────────────────────────────── */}
      <div
        id="dossier-moodboard"
        className="mt-7 mb-2 flex items-center gap-2 scroll-mt-48"
      >
        <span
          className="inline-block w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: "#F59E0B" }}
          aria-hidden="true"
        />
        <span
          className="text-xs font-code font-bold uppercase tracking-widest"
          style={{ color: "#F59E0B" }}
        >
          Moodboard
        </span>
        <span className="flex-1 border-t border-zinc-400" />
      </div>

      {/* Editorial CTA card — modern launcher. Hover lifts tone only (no
          layout-shifting scale); the chevron is the only moving part. */}
      <button
        onClick={openBoard}
        aria-label={`${data ? "Open" : "Generate"} brand moodboard for ${orgName}`}
        className="group relative w-full overflow-hidden rounded-lg border border-editorial-black/15 bg-white text-left transition-colors duration-200 hover:border-editorial-black/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 cursor-pointer"
      >
        {/* 5-accent spectrum hairline — the dossier's signature motif */}
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-[3px]"
          style={{
            background:
              "linear-gradient(90deg,#4F46E5 0%,#7C3AED 28%,#0D9488 55%,#F59E0B 80%,#E11D48 100%)",
          }}
        />
        <div className="flex items-center gap-4 px-4 py-3.5 pt-4">
          {/* Amber emblem tile */}
          <span
            aria-hidden="true"
            className="flex-shrink-0 grid place-items-center w-11 h-11 rounded-md transition-colors duration-200"
            style={{ backgroundColor: "#FBF1DC", color: "#B45309" }}
          >
            <Palette size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-code font-semibold uppercase tracking-[0.3em] text-amber-700/80">
              {data ? "View · Visual identity" : "Generate · Visual identity"}
            </div>
            <div className="font-sans font-semibold text-[15px] text-editorial-black leading-tight">
              {data ? "Open Brand Moodboard" : "Generate Brand Moodboard"}
            </div>
            <p className="text-[11px] font-sans text-editorial-muted leading-snug mt-0.5 line-clamp-2">
              Imagery, colour palette, typography, voice &amp; programmes pulled
              from the buyer&apos;s own site — exportable as PDF.
            </p>
          </div>
          <ChevronRight
            size={18}
            aria-hidden="true"
            className="flex-shrink-0 text-editorial-muted transition-transform duration-200 group-hover:translate-x-1 group-hover:text-editorial-black"
          />
        </div>
      </button>

      {/* ── Left panel ───────────────────────────────────────────────── */}
      {open && (
        <div
          className="moodboard-panel"
          role="dialog"
          aria-modal="false"
          aria-label={`${orgName} moodboard`}
        >
          {/* Sticky header: title + actions */}
          <div className="sticky top-0 bg-white z-10 px-6 pt-4 pb-3 border-b border-editorial-black">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-code font-semibold uppercase tracking-[0.25em] text-editorial-muted">
                  Brand Moodboard
                </div>
                <h2 className="font-sans font-semibold text-xl text-editorial-black leading-tight truncate">
                  {orgName}
                </h2>
                {data?.editorial?.dateline && (
                  <div className="text-[10px] font-code uppercase tracking-[0.2em] text-editorial-muted mt-0.5 truncate">
                    {data.editorial.dateline}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => generate(true)}
                  disabled={loading || exporting}
                  className="flex items-center gap-1 px-2 py-1.5 rounded text-xs font-sans text-editorial-secondary hover:bg-zinc-100 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Rebuild from the live site"
                >
                  {loading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <RefreshCw size={14} />
                  )}
                  Regenerate
                </button>
                <button
                  onClick={exportPdf}
                  disabled={!data || loading || exporting}
                  className="flex items-center gap-1 px-2 py-1.5 rounded text-xs font-sans text-editorial-secondary hover:bg-zinc-100 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Download as PDF"
                >
                  {exporting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <FileDown size={14} />
                  )}
                  PDF
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded hover:bg-zinc-100 transition-colors cursor-pointer"
                  aria-label="Close moodboard"
                >
                  <X size={18} className="text-editorial-secondary" />
                </button>
              </div>
            </div>
          </div>

          <div
            className="px-6 py-5 min-h-full"
            style={{ backgroundColor: paper }}
          >
            {loading && (
              <div className="flex items-center gap-2 text-sm font-sans text-editorial-muted py-10 justify-center">
                <Loader2 size={16} className="animate-spin" />
                Building the board from {website.replace(/^https?:\/\/(www\.)?/i, "")}…
              </div>
            )}

            {error && !loading && (
              <p className="text-xs font-sans text-red-600 py-4">{error}</p>
            )}

            {data && !loading && (
              <div className="space-y-4">
                {/* Masthead: logo + aesthetic line */}
                {(logo || data.editorial?.aesthetic) && (
                  <div className="flex items-end justify-between gap-4 flex-wrap">
                    {logo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logo}
                        alt={`${orgName} logo`}
                        className="h-10 max-w-[140px] object-contain"
                        loading="lazy"
                      />
                    )}
                    {data.editorial?.aesthetic && (
                      <span className="text-[10px] font-code uppercase tracking-[0.25em] text-editorial-muted">
                        {data.editorial.aesthetic}
                      </span>
                    )}
                  </div>
                )}

                {/* Wide panels split into visuals (left) + brand
                    intelligence (right); narrow panels stack. */}
                <div className="grid gap-4 min-[1500px]:grid-cols-[3fr_2fr] min-[1500px]:items-start">
                <div className="space-y-4 min-w-0">
                {/* Hero image */}
                {hero && (
                  <div className="relative rounded overflow-hidden border border-zinc-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={hero.src}
                      alt={imgLabel(hero) ?? ""}
                      loading="lazy"
                      className="w-full h-56 object-cover bg-zinc-50"
                      onError={() =>
                        setFailed((prev) => new Set(prev).add(hero.src))
                      }
                    />
                    {imgLabel(hero) && (
                      <span className="absolute left-2.5 bottom-2.5 px-2 py-1 rounded-sm bg-zinc-900/85 text-zinc-100 text-[9px] font-code uppercase tracking-wider">
                        {imgLabel(hero)!.slice(0, 60)}
                      </span>
                    )}
                  </div>
                )}

                {/* Image grid with curated labels */}
                {rest.length > 0 && (
                  <div className="grid grid-cols-3 gap-1.5">
                    {rest.map((img) => (
                      <div
                        key={img.src}
                        className="relative rounded overflow-hidden border border-zinc-200"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.src}
                          alt={imgLabel(img) ?? ""}
                          title={imgLabel(img) ?? undefined}
                          loading="lazy"
                          className="w-full aspect-square object-cover bg-zinc-50"
                          onError={() =>
                            setFailed((prev) => new Set(prev).add(img.src))
                          }
                        />
                        {imgLabel(img) && (
                          <span className="absolute left-1.5 bottom-1.5 px-1.5 py-0.5 rounded-sm bg-zinc-900/85 text-zinc-100 text-[8px] font-code uppercase tracking-wider max-w-[90%] truncate">
                            {imgLabel(img)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Screenshot fallback when the site blocks image scraping */}
                {images.length === 0 && data.screenshot && (
                  <div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={data.screenshot}
                      alt={`${orgName} website`}
                      loading="lazy"
                      className="w-full max-h-[480px] object-cover object-top rounded border border-zinc-200"
                    />
                    <p className="text-[10px] font-sans text-editorial-muted mt-1">
                      Site blocks image extraction — showing a full-page
                      capture instead.
                    </p>
                  </div>
                )}
                </div>

                <div className="space-y-4 min-w-0">
                {/* Brand quote panel — REAL brand words only (MOODBOARD.md §3) */}
                {quote && (
                  <div
                    className="rounded px-6 py-5"
                    style={{
                      backgroundColor: accent,
                      color: contrastText(accent),
                    }}
                  >
                    <p className="font-serif italic text-base leading-snug">
                      “{quote.text}”
                    </p>
                    <p className="mt-2.5 text-[9px] font-code uppercase tracking-[0.2em] opacity-75">
                      {quote.type === "slogan" ? "Slogan" : "Brand essence"}
                    </p>
                  </div>
                )}

                {/* Color palette — 6 swatches */}
                {palette.length > 0 && (
                  <div>
                    <div className="text-[10px] font-code font-semibold uppercase tracking-[0.25em] text-editorial-muted mb-1.5">
                      Color Palette
                    </div>
                    <div
                      className="grid gap-1.5"
                      style={{
                        gridTemplateColumns: `repeat(${Math.min(palette.length, 6)}, 1fr)`,
                      }}
                    >
                      {palette.slice(0, 6).map((c) => (
                        <div
                          key={c.hex}
                          className="h-16 rounded border border-zinc-200 flex flex-col justify-end p-1.5"
                          style={{
                            backgroundColor: c.hex,
                            color: contrastText(c.hex),
                          }}
                        >
                          <span className="text-[9px] font-sans font-semibold leading-tight">
                            {c.name}
                          </span>
                          <span className="text-[8px] font-code opacity-75">
                            {c.hex.toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Typography & voice — samples render in the buyer's real
                    typefaces, loaded straight from their font files */}
                {(data.typography || (data.editorial?.voiceKeywords?.length ?? 0) > 0) && (
                  <div>
                    {data.typography && (
                      <style
                        dangerouslySetInnerHTML={{
                          __html: fontFaceCss(data.typography),
                        }}
                      />
                    )}
                    <div className="text-[10px] font-code font-semibold uppercase tracking-[0.25em] text-editorial-muted mb-1.5">
                      Typography &amp; Voice
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="rounded border border-zinc-200 bg-white p-4">
                        <div className="text-[9px] font-code uppercase tracking-[0.2em] text-editorial-muted mb-2">
                          Display
                          {data.typography?.display.name
                            ? ` · ${data.typography.display.name}`
                            : ""}
                        </div>
                        <div
                          className="text-2xl leading-tight text-editorial-black"
                          style={{ fontFamily: faceStack(data.typography?.display) }}
                        >
                          Aa Bb Cc
                        </div>
                        {/* Specimen line in the brand's own voice (§6) */}
                        <div
                          className="text-sm mt-1.5 text-editorial-secondary"
                          style={{ fontFamily: faceStack(data.typography?.display) }}
                        >
                          {/* Specimen line — real words only: slogan, else
                              the brand name. No fabricated copy. */}
                          {quote?.text ?? orgName}
                        </div>
                      </div>
                      <div className="rounded border border-zinc-200 bg-white p-4">
                        <div className="text-[9px] font-code uppercase tracking-[0.2em] text-editorial-muted mb-2">
                          Text
                          {data.typography?.text.name
                            ? ` · ${data.typography.text.name}`
                            : ""}
                        </div>
                        <div
                          className="text-xl leading-tight text-editorial-black"
                          style={{ fontFamily: faceStack(data.typography?.text) }}
                        >
                          Aa Bb Cc 0123456789
                        </div>
                        {(data.editorial?.voiceKeywords?.length ?? 0) > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2.5">
                            {data.editorial!.voiceKeywords.map((k) => (
                              <span
                                key={k}
                                className="px-2 py-0.5 text-[9px] font-code uppercase tracking-wider border border-zinc-300 rounded-full text-editorial-secondary"
                              >
                                {k}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Programs & lines — the buyer's OWN sub-brands and
                    memberships, solid chips (§4) */}
                {(data.editorial?.programs?.length ?? 0) > 0 && (
                  <div>
                    <div className="text-[10px] font-code font-semibold uppercase tracking-[0.25em] text-editorial-muted mb-1.5">
                      Programs &amp; Lines
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {data.editorial!.programs.map((p) => (
                        <span
                          key={p}
                          className="px-2.5 py-1 text-[10px] font-sans rounded-full"
                          style={{
                            backgroundColor: accent,
                            color: contrastText(accent),
                          }}
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* About */}
                {data.brand?.description && (
                  <div>
                    <div className="text-[10px] font-code font-semibold uppercase tracking-[0.25em] text-editorial-muted mb-1.5">
                      About
                    </div>
                    <p className="text-xs font-sans text-editorial-secondary leading-relaxed">
                      {data.brand.description}
                    </p>
                  </div>
                )}
                </div>
                </div>

                <p className="text-[10px] font-code text-editorial-muted border-t border-zinc-300 pt-3">
                  Source: {website.replace(/^https?:\/\/(www\.)?/i, "")}
                  {data.editorial?.dateline ? ` · ${data.editorial.dateline}` : ""}
                  {" · imagery via live site · built "}
                  {new Date(data.fetchedAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
