"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { getStoredEmail } from "@/lib/access";

/**
 * Masthead bell for the AM daily brief. Renders only when the current
 * (self-entered) email maps to an AM in am_directory. The badge is the count
 * of leads (re)assigned to that AM since they last opened /brief.
 */
export default function BriefBell() {
  const [configured, setConfigured] = useState(false);
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    const email = getStoredEmail();
    if (!email) {
      setConfigured(false);
      return;
    }
    try {
      const res = await fetch(`/api/brief?email=${encodeURIComponent(email)}`);
      if (!res.ok) return;
      const data = await res.json();
      setConfigured(Boolean(data.configured));
      setCount(Number(data.count) || 0);
    } catch {
      /* offline / transient — leave the last known state */
    }
  }, []);

  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  if (!configured) return null;

  return (
    <Link
      href="/brief"
      aria-label={count > 0 ? `Daily brief — ${count} new` : "Daily brief"}
      className="relative inline-flex items-center justify-center w-8 h-8 rounded-full border border-zinc-200 text-editorial-secondary hover:text-editorial-black hover:border-zinc-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-editorial-accent"
      title="Your daily brief"
    >
      <Bell size={15} />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-editorial-accent text-white text-[10px] font-bold font-sans leading-4 text-center">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
