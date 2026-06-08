"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

export interface ToastState {
  message: string;
  type: ToastType;
  /** Bump this to re-trigger the same message (e.g. repeated syncs). */
  key: number;
}

const LABELS: Record<ToastType, string> = {
  success: "Done",
  error: "Error",
  info: "Status",
};

interface ToastProps {
  toast: ToastState | null;
  onDismiss: () => void;
  /** Auto-dismiss after N ms. Errors stay until dismissed by default. */
  duration?: number;
}

export default function Toast({ toast, onDismiss, duration }: ToastProps) {
  useEffect(() => {
    if (!toast) return;
    // Errors persist; success/info auto-dismiss.
    const ms = duration ?? (toast.type === "error" ? 0 : 4000);
    if (ms <= 0) return;
    const t = setTimeout(onDismiss, ms);
    return () => clearTimeout(t);
  }, [toast, duration, onDismiss]);

  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`toast toast-${toast.type}`}
    >
      <span className="toast-label">{LABELS[toast.type]}</span>
      <span className="toast-msg">{toast.message}</span>
      <button
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="toast-dismiss"
      >
        <X size={13} />
      </button>
    </div>
  );
}
