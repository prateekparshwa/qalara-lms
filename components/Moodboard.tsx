"use client";

import { useState } from "react";
import { Loader2, Palette, RefreshCw } from "lucide-react";
import type { Lead } from "@/lib/leads";

/**
 * "Moodboard" dossier section — the buyer's visual identity, built on demand
 * from their website (context.dev images + brand data, Firecrawl screenshot
 * fallback). Costs API credits, so it never auto-runs: a Generate button
 * triggers it, and the result is cached server-side for 7 days.
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
  fetchedAt: string;
}

export default function Moodboard({ lead }: { lead: Lead }) {
  const initial =
    (lead.enrichment_cache?.moodboard as MoodboardData | undefined) ?? null;
  const [data, setData] = useState<MoodboardData | null>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState<Set<string>>(new Set());

  const website = (lead.website ?? "").trim();
  if (!website) return null;

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/enrich/moodboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id, url: website }),
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

  const logo = data?.brand?.logos?.[0]?.url ?? null;
  const colors = data?.brand?.colors ?? [];
  const images = (data?.images ?? []).filter((i) => !failed.has(i.src));

  return (
    <div>
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
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-sans font-medium border border-editorial-black rounded hover:bg-editorial-black hover:text-white transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 size={10} className="animate-spin" />
              Building…
            </>
          ) : data ? (
            <>
              <RefreshCw size={10} />
              Refresh
            </>
          ) : (
            <>
              <Palette size={10} />
              Generate
            </>
          )}
        </button>
      </div>

      {!data && !loading && !error && (
        <p className="text-[11px] font-sans text-editorial-muted">
          Build a visual board from the buyer&apos;s website — their imagery,
          brand colors and logo. Cached for 7 days.
        </p>
      )}

      {error && (
        <p className="text-[11px] font-sans text-red-600">{error}</p>
      )}

      {data && (
        <div className="space-y-3">
          {/* Brand layer: logo + official color swatches */}
          {(logo || colors.length > 0) && (
            <div className="flex items-center gap-4 flex-wrap py-1">
              {logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logo}
                  alt={`${data.brand?.title ?? lead.organization ?? "Brand"} logo`}
                  className="h-10 max-w-[140px] object-contain"
                  loading="lazy"
                />
              )}
              {colors.length > 0 && (
                <div className="flex items-center gap-1.5">
                  {colors.slice(0, 6).map((c) => (
                    <span
                      key={c.hex}
                      className="inline-block w-6 h-6 rounded border border-zinc-200"
                      style={{ backgroundColor: c.hex }}
                      title={c.name ? `${c.name} ${c.hex}` : c.hex}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {data.brand?.slogan && (
            <p className="text-sm font-sans italic text-editorial-secondary">
              “{data.brand.slogan}”
            </p>
          )}

          {/* The site's own imagery */}
          {images.length > 0 && (
            <div className="grid grid-cols-3 gap-1.5">
              {images.map((img) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={img.src}
                  src={img.src}
                  alt={img.alt ?? ""}
                  title={img.alt ?? undefined}
                  loading="lazy"
                  className="w-full aspect-square object-cover rounded border border-zinc-200 bg-zinc-50"
                  onError={() =>
                    setFailed((prev) => new Set(prev).add(img.src))
                  }
                />
              ))}
            </div>
          )}

          {/* Screenshot fallback when the site blocks image scraping */}
          {images.length === 0 && data.screenshot && (
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={data.screenshot}
                alt={`${lead.organization ?? "Buyer"} website`}
                loading="lazy"
                className="w-full max-h-[420px] object-cover object-top rounded border border-zinc-200"
              />
              <p className="text-[10px] font-sans text-editorial-muted mt-1">
                Site blocks image extraction — showing a full-page capture
                instead.
              </p>
            </div>
          )}

          <p className="text-[10px] font-code text-editorial-muted">
            via context.dev · built{" "}
            {new Date(data.fetchedAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
            })}
          </p>
        </div>
      )}
    </div>
  );
}
