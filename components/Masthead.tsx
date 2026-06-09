import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shared editorial masthead for the lobby and the directory chooser.
 * The signature 5-accent gradient strip + the QALARA wordmark over a hairline
 * ink rule — the "broadsheet" gesture, reused so every top-level screen reads
 * as the same publication.
 */
export default function Masthead({
  right,
  subtitle,
  href = "/",
}: {
  right?: ReactNode;
  subtitle?: string;
  /** Wordmark links here (defaults to the lobby). */
  href?: string;
}) {
  return (
    <header className="bg-white">
      <div
        className="h-1 w-full"
        style={{
          background:
            "linear-gradient(90deg, #4F46E5 0%, #7C3AED 30%, #0D9488 60%, #F59E0B 82%, #E11D48 100%)",
        }}
        aria-hidden="true"
      />
      <div className="max-w-6xl mx-auto px-6 lg:px-10 pt-6 pb-4 flex items-end justify-between gap-6">
        <div>
          <Link
            href={href}
            className="inline-flex items-baseline gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-editorial-accent rounded-sm"
          >
            <span className="font-code font-bold text-xl tracking-tight text-editorial-black">
              QALARA
            </span>
            <span className="text-editorial-accent font-code font-bold text-xl">
              ·
            </span>
            <span className="font-code font-bold text-xl tracking-[0.18em] text-editorial-black uppercase">
              Buyer Intelligence
            </span>
          </Link>
          {subtitle && (
            <p className="mt-1 text-sm text-editorial-muted font-sans">
              {subtitle}
            </p>
          )}
        </div>
        {right && <div className="flex-shrink-0 pb-0.5">{right}</div>}
      </div>
      <div className="max-w-6xl mx-auto px-6 lg:px-10">
        <div className="border-t border-editorial-black" />
      </div>
    </header>
  );
}
