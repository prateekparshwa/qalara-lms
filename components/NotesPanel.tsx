"use client";

import { useState, useEffect } from "react";
import {
  Loader2,
  Check,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { getStoredEmail } from "@/lib/access";
import { formatIst } from "@/lib/format";
import type { Lead } from "@/lib/leads";

interface NotesPanelProps {
  lead: Lead;
  /** Collapsible open state (controlled by the host so a nav pill can expand it). */
  open: boolean;
  onToggleOpen: () => void;
  scrollMtClass?: string;
  /** Notified after a successful save so the host can patch its lead state. */
  onSaved?: (
    id: number,
    notes: string | null,
    updatedAt: string | null,
    updatedBy: string | null
  ) => void;
}

export default function NotesPanel({
  lead,
  open,
  onToggleOpen,
  scrollMtClass,
  onSaved,
}: NotesPanelProps) {
  const [text, setText] = useState(lead.notes ?? "");
  // Baseline = the last saved value, for dirty-tracking and reset.
  const [baseline, setBaseline] = useState(lead.notes ?? "");
  const [meta, setMeta] = useState<{ at: string | null; by: string | null }>({
    at: lead.notes_updated_at ?? null,
    by: lead.notes_updated_by ?? null,
  });
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset everything when the drawer switches to a different lead.
  useEffect(() => {
    setText(lead.notes ?? "");
    setBaseline(lead.notes ?? "");
    setMeta({
      at: lead.notes_updated_at ?? null,
      by: lead.notes_updated_by ?? null,
    });
    setJustSaved(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id]);

  const dirty = text !== baseline;

  const save = async () => {
    if (saving || !dirty) return;
    setSaving(true);
    setJustSaved(false);
    setError(null);
    try {
      const author = getStoredEmail();
      const res = await fetch("/api/leads/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: lead.id, notes: text, author }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      const savedNotes: string | null = data.notes ?? null;
      setBaseline(savedNotes ?? "");
      setText(savedNotes ?? "");
      setMeta({
        at: data.notes_updated_at ?? null,
        by: data.notes_updated_by ?? null,
      });
      setJustSaved(true);
      onSaved?.(
        lead.id,
        savedNotes,
        data.notes_updated_at ?? null,
        data.notes_updated_by ?? null
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save notes.");
    } finally {
      setSaving(false);
    }
  };

  const editedWhen = formatIst(meta.at);
  const hasNote = baseline.trim() !== "";

  return (
    <div id="dossier-notes" className={`mt-7 ${scrollMtClass ?? ""}`}>
      <button
        onClick={onToggleOpen}
        aria-expanded={open}
        className="w-full mb-2 flex items-center gap-2 text-left cursor-pointer"
      >
        <span
          className="inline-block w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: "#0D9488" }}
          aria-hidden="true"
        />
        <span
          className="text-xs font-code font-bold uppercase tracking-widest"
          style={{ color: "#0D9488" }}
        >
          AM Notes
        </span>
        {dirty && (
          <span className="text-[9px] font-sans font-bold text-teal-700 bg-teal-100 border border-teal-300 rounded px-1 py-0.5 uppercase tracking-wide">
            Unsaved
          </span>
        )}
        {!open && (
          <span className="text-[10px] font-sans text-editorial-muted truncate">
            {hasNote
              ? editedWhen
                ? `Last edited ${meta.by ? `by ${meta.by} ` : ""}on ${editedWhen}`
                : "Note saved"
              : "No notes yet — click to add"}
          </span>
        )}
        <span className="flex-shrink-0 text-editorial-muted">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <span className="flex-1 border-t border-zinc-400" />
      </button>

      {open && (
        <div className="pb-1">
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setJustSaved(false);
        }}
        rows={4}
        placeholder="Add notes about this buyer — context, next steps, anything the team should know…"
        className="w-full px-3 py-2 text-sm font-sans text-editorial-black border border-teal-200 rounded bg-white placeholder:text-editorial-muted focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/25 transition-colors resize-y"
      />
      <div className="mt-2 flex items-center justify-between gap-3 flex-wrap">
        <div className="text-[10px] font-sans text-editorial-muted min-w-0">
          {error ? (
            <span className="inline-flex items-center gap-1 text-red-600">
              <AlertCircle size={11} /> {error}
            </span>
          ) : justSaved ? (
            <span className="inline-flex items-center gap-1 text-green-700">
              <Check size={11} /> Saved
            </span>
          ) : editedWhen ? (
            <span className="truncate">
              Last edited {meta.by ? `by ${meta.by} ` : ""}on {editedWhen}
            </span>
          ) : (
            <span>No notes saved yet.</span>
          )}
        </div>
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-sans font-bold rounded text-white bg-teal-600 hover:bg-teal-700 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50"
        >
          {saving ? (
            <>
              <Loader2 size={12} className="animate-spin" /> Saving…
            </>
          ) : (
            "Save notes"
          )}
        </button>
      </div>
        </div>
      )}
    </div>
  );
}
