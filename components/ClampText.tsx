"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * Collapsible long-text block for dossier fields whose value can run very long
 * (raw email bodies pasted into "Last Email Summary / Sales POC Notes", email
 * snapshots, etc.). Shows the first `lines` lines, then a "Show more" toggle —
 * the toggle only appears when the text actually overflows that height.
 */
export default function ClampText({
  text,
  lines = 4,
}: {
  text: string;
  lines?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Measure against the clamped height regardless of current expand state.
    const check = () => {
      const clamped = el.scrollHeight > el.clientHeight + 1;
      // When expanded the element is unclamped, so fall back to a length
      // heuristic to keep the toggle visible.
      setOverflowing(expanded ? text.length > 260 : clamped);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [text, expanded, lines]);

  return (
    <>
      <div
        ref={ref}
        style={
          expanded
            ? undefined
            : {
                display: "-webkit-box",
                WebkitLineClamp: lines,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }
        }
      >
        {text}
      </div>
      {overflowing && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-1 text-xs font-sans font-semibold text-editorial-accent hover:underline cursor-pointer"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </>
  );
}
