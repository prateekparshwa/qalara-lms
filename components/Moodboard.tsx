"use client";

import { useEffect, useState } from "react";
import { FileDown, Loader2, Palette, RefreshCw, X } from "lucide-react";
import type { Lead } from "@/lib/leads";
import { downloadMoodboardPdf, MoodboardPdfData } from "@/lib/moodboardPdf";

/**
 * "Moodboard" — an editorial board of the buyer's visual identity, built on
 * demand from their website (context.dev images + brand data, an LLM
 * editorial layer, Firecrawl screenshot fallback).
 *
 * The dossier carries only a launcher button; the board itself opens in a
 * full-height panel on the LEFT (the dossier drawer stays on the right), with
 * Regenerate / Download PDF / Close in its header. First open builds the
 * board; afterwards it's served from a 7-day server-side cache.
 */

interface MoodboardData {
  brand: {
    title: string | null;
    description: string | null;
    slogan: string | null;
    colors: { hex: string; name?: string }[];
    logos: { url: string; mode?: string; type?: string }[];
    socials: { type: string; url: string }[];
  } | null;
  images: { src: string; alt: string | null }[];
  screenshot: string | null;
  editorial: {
    tagline: string | null;
    aesthetic: string | null;
    voiceKeywords: string[];
    collections: string[];
    palette: { hex: string; name: string }[];
  } | null;
  fetchedAt: string;
}

function contrastText(hex: string): string {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#18181b" : "#fafaf9";
}

export default function Moodboard({ lead }: { lead: Lead }) {
  const initial =
    (lead.enrichment_cache?.moodboard as MoodboardData | undefined) ?? null;
  // Pre-v2 cache entries (no editorial layer) are rebuilt on open.
  const [data, setData] = useState<MoodboardData | null>(
    initial && "editorial" in initial ? initial : null
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
  const accent = palette[0]?.hex ?? "#18181b";
  const images = (data?.images ?? []).filter((i) => !failed.has(i.src));
  const hero = images[0] ?? null;
  const rest = images.slice(1);
  const tagline = data?.editorial?.tagline ?? data?.brand?.slogan ?? null;
  const orgName = data?.brand?.title ?? lead.organization ?? "Buyer";

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
        <button
          onClick={openBoard}
          className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-sans font-medium border border-editorial-black rounded hover:bg-editorial-black hover:text-white transition-colors duration-150 cursor-pointer"
        >
          <Palette size={10} />
          {data ? "Open Moodboard" : "Generate Moodboard"}
        </button>
      </div>
      <p className="text-[11px] font-sans text-editorial-muted">
        An editorial board of the buyer&apos;s visual identity — imagery, brand
        colors, voice and collections from their website. Opens alongside the
        dossier; exportable as PDF.
      </p>

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

          <div className="px-6 py-5">
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

                {/* Hero image */}
                {hero && (
                  <div className="relative rounded overflow-hidden border border-zinc-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={hero.src}
                      alt={hero.alt ?? ""}
                      loading="lazy"
                      className="w-full h-56 object-cover bg-zinc-50"
                      onError={() =>
                        setFailed((prev) => new Set(prev).add(hero.src))
                      }
                    />
                    {hero.alt && (
                      <span className="absolute left-2.5 bottom-2.5 px-2 py-1 rounded-sm bg-zinc-900/85 text-zinc-100 text-[9px] font-code uppercase tracking-wider">
                        {hero.alt.slice(0, 60)}
                      </span>
                    )}
                  </div>
                )}

                {/* Image grid with labels */}
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
                          alt={img.alt ?? ""}
                          title={img.alt ?? undefined}
                          loading="lazy"
                          className="w-full aspect-square object-cover bg-zinc-50"
                          onError={() =>
                            setFailed((prev) => new Set(prev).add(img.src))
                          }
                        />
                        {img.alt && (
                          <span className="absolute left-1.5 bottom-1.5 px-1.5 py-0.5 rounded-sm bg-zinc-900/85 text-zinc-100 text-[8px] font-code uppercase tracking-wider max-w-[90%] truncate">
                            {img.alt}
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

                {/* Brand quote panel */}
                {tagline && (
                  <div
                    className="rounded px-6 py-5"
                    style={{
                      backgroundColor: accent,
                      color: contrastText(accent),
                    }}
                  >
                    <p className="font-serif italic text-base leading-snug">
                      “{tagline}”
                    </p>
                    {(data.editorial?.voiceKeywords?.length ?? 0) > 0 && (
                      <p className="mt-2.5 text-[9px] font-code uppercase tracking-[0.2em] opacity-75">
                        {data.editorial!.voiceKeywords.join("  ·  ")}
                      </p>
                    )}
                  </div>
                )}

                {/* Color palette */}
                {palette.length > 0 && (
                  <div>
                    <div className="text-[10px] font-code font-semibold uppercase tracking-[0.25em] text-editorial-muted mb-1.5">
                      Color Palette
                    </div>
                    <div
                      className="grid gap-1.5"
                      style={{
                        gridTemplateColumns: `repeat(${Math.min(palette.length, 4)}, 1fr)`,
                      }}
                    >
                      {palette.slice(0, 4).map((c) => (
                        <div
                          key={c.hex}
                          className="h-16 rounded border border-zinc-200 flex flex-col justify-end p-2"
                          style={{
                            backgroundColor: c.hex,
                            color: contrastText(c.hex),
                          }}
                        >
                          <span className="text-[10px] font-sans font-semibold leading-tight">
                            {c.name}
                          </span>
                          <span className="text-[9px] font-code opacity-75">
                            {c.hex.toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Collections / lines */}
                {(data.editorial?.collections?.length ?? 0) > 0 && (
                  <div>
                    <div className="text-[10px] font-code font-semibold uppercase tracking-[0.25em] text-editorial-muted mb-1.5">
                      Collections &amp; Lines
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {data.editorial!.collections.map((c) => (
                        <span
                          key={c}
                          className="px-2.5 py-1 text-[10px] font-sans border border-zinc-300 rounded-full text-editorial-secondary"
                        >
                          {c}
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

                <p className="text-[10px] font-code text-editorial-muted border-t border-zinc-200 pt-3">
                  Source: {website.replace(/^https?:\/\/(www\.)?/i, "")} ·
                  imagery and colors extracted from the official site · built{" "}
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
