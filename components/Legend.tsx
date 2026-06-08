"use client";

import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import { PRIORITY_LEGEND, WEB_LEGEND } from "@/lib/glossary";

/**
 * Small discoverable legend explaining the Priority and Web badges.
 * Click the info button to toggle; Escape or outside-click closes it.
 */
export default function Legend() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="What do Priority and Web mean?"
        className="flex items-center gap-1 text-xs font-sans text-editorial-muted hover:text-editorial-black transition-colors cursor-pointer"
      >
        <Info size={12} />
        What do these mean?
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Badge legend"
          className="absolute bottom-full left-0 mb-2 w-72 bg-white border border-zinc-200 rounded shadow-lg p-4 z-50"
        >
          <div className="mb-3">
            <div className="text-[10px] font-code font-bold uppercase tracking-widest text-editorial-muted mb-1.5">
              Priority
            </div>
            <p className="text-xs font-sans text-editorial-secondary mb-2">
              How strong a prospect this buyer is (HiPo tier).
            </p>
            <ul className="space-y-1">
              {PRIORITY_LEGEND.map((item) => (
                <li key={item.code} className="flex items-baseline gap-2 text-xs font-sans">
                  <span className="font-code font-semibold text-editorial-black w-10 flex-shrink-0">
                    {item.code}
                  </span>
                  <span className="text-editorial-secondary">{item.desc}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="pt-3 border-t border-zinc-100">
            <div className="text-[10px] font-code font-bold uppercase tracking-widest text-editorial-muted mb-1.5">
              Web
            </div>
            <p className="text-xs font-sans text-editorial-secondary mb-2">
              How confidently this lead&apos;s website was verified.
            </p>
            <ul className="space-y-1">
              {WEB_LEGEND.map((item) => (
                <li key={item.code} className="flex items-baseline gap-2 text-xs font-sans">
                  <span className="font-code font-semibold text-editorial-black w-10 flex-shrink-0">
                    {item.code}
                  </span>
                  <span className="text-editorial-secondary">{item.desc}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
