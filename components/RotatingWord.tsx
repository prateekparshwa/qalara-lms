"use client";

import { useEffect, useState } from "react";

/**
 * Cycles through `words` in place with a fade-up transition.
 * Respects prefers-reduced-motion (holds the first word static).
 */
export default function RotatingWord({
  words,
  intervalMs = 2200,
  className,
  style,
}: {
  words: string[];
  intervalMs?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(true);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return; // keep the first word, no animation
    }

    const id = setInterval(() => {
      setShown(false); // fade current word out
      window.setTimeout(() => {
        setIndex((i) => (i + 1) % words.length);
        setShown(true); // fade next word in
      }, 300);
    }, intervalMs);

    return () => clearInterval(id);
  }, [words.length, intervalMs]);

  return (
    <span
      className={`rotating-word ${shown ? "rw-in" : "rw-out"} ${className ?? ""}`}
      style={style}
    >
      {words[index]}
    </span>
  );
}
