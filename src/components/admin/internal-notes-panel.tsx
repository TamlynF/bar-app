"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { attempt } from "@/lib/attempt";

export type InternalNote = {
  id: string;
  body: string;
  created_at: string;
  author?: { full_name: string | null } | { full_name: string | null }[] | null;
};

const COLLAPSED_COUNT = 3;

function authorName(note: InternalNote): string {
  const a = Array.isArray(note.author) ? note.author[0] : note.author;
  return a?.full_name?.trim() || "Unknown";
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong.";
}

export function InternalNotesPanel({
  notes,
  editable,
  placeholder = "Add a note for the team…",
  onAdd,
  onUpdate,
  onDelete,
}: {
  notes: InternalNote[];
  editable: boolean;
  placeholder?: string;
  onAdd: (body: string) => Promise<void>;
  onUpdate: (id: string, body: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [isPending, startTransition] = useTransition();

  const newestFirst = [...notes].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const shown = showAll ? newestFirst : newestFirst.slice(0, COLLAPSED_COUNT);
  const hiddenCount = newestFirst.length - shown.length;

  function run(work: () => Promise<void>, done: () => void) {
    startTransition(async () => {
      let ok = true;
      await attempt(work, (err) => {
        ok = false;
        toast.error(errorMessage(err));
      });
      if (ok) done();
    });
  }

  function add() {
    const text = draft.trim();
    if (!text) return;
    run(
      () => onAdd(text),
      () => {
        setDraft("");
        toast.success("Note added");
      }
    );
  }

  function saveEdit(id: string) {
    const text = editText.trim();
    if (!text) return;
    run(
      () => onUpdate(id, text),
      () => {
        setEditingId(null);
        toast.success("Note saved");
      }
    );
  }

  function remove(id: string) {
    run(
      () => onDelete(id),
      () => {
        setConfirmingId(null);
        toast.success("Note deleted");
      }
    );
  }

  return (
    <div className="space-y-3 p-4 sm:px-5">
      {notes.length === 0 ? (
        <p className="text-[13px] text-admin-muted">No notes yet.</p>
      ) : (
        <ul className="space-y-2">
          {shown.map((note) => {
            const isEditing = editingId === note.id;
            return (
              <li key={note.id} className="rounded-xl border border-admin-line bg-admin-surface/50 px-3 py-2">
                {isEditing ? (
                  <textarea
                    aria-label={`Edit note by ${authorName(note)}`}
                    value={editText}
                    rows={3}
                    autoFocus
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full resize-none rounded-lg border border-admin-line bg-white px-2.5 py-1.5 text-[13px] leading-relaxed text-admin-ink outline-none focus:border-admin-primary/40"
                  />
                ) : (
                  <p className="text-[13px] leading-relaxed break-words whitespace-pre-line text-admin-ink">
                    {note.body}
                  </p>
                )}
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="truncate text-[12px] text-admin-muted">
                    {authorName(note)} · {format(new Date(note.created_at), "d MMM yyyy, HH:mm")}
                  </span>
                  {editable && (
                    <span className="flex shrink-0 items-center gap-1">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="rounded-lg px-2 py-1 text-[12px] font-semibold text-admin-muted transition-colors hover:bg-admin-surface"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={isPending || !editText.trim() || editText.trim() === note.body.trim()}
                            onClick={() => saveEdit(note.id)}
                            className="rounded-lg bg-[#34451F] px-2.5 py-1 text-[12px] font-semibold text-white transition-colors hover:bg-[#283719] disabled:opacity-50"
                          >
                            Save
                          </button>
                        </>
                      ) : confirmingId === note.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setConfirmingId(null)}
                            className="rounded-lg px-2 py-1 text-[12px] font-semibold text-admin-muted transition-colors hover:bg-admin-surface"
                          >
                            Keep
                          </button>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => remove(note.id)}
                            className="rounded-lg bg-[#B33A32] px-2.5 py-1 text-[12px] font-semibold text-white transition-colors hover:bg-[#9a312a] disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            aria-label="Edit note"
                            title="Edit note"
                            onClick={() => {
                              setConfirmingId(null);
                              setEditingId(note.id);
                              setEditText(note.body);
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-admin-muted transition-colors hover:bg-admin-surface hover:text-admin-ink"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Delete note"
                            title="Delete note"
                            onClick={() => {
                              setEditingId(null);
                              setConfirmingId(note.id);
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-admin-muted transition-colors hover:bg-admin-error-bg hover:text-admin-error"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {(hiddenCount > 0 || showAll) && newestFirst.length > COLLAPSED_COUNT && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="text-[12px] font-semibold text-admin-primary hover:underline"
        >
          {showAll ? "Show fewer" : `View all ${newestFirst.length} notes`}
        </button>
      )}

      {editable && (
        <div className="space-y-2 border-t border-admin-line pt-3">
          <textarea
            aria-label="New internal note"
            value={draft}
            rows={2}
            placeholder={placeholder}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                add();
              }
            }}
            className="w-full resize-y rounded-xl border border-admin-line bg-admin-card px-3 py-2 text-[13px] text-admin-ink transition-colors placeholder:text-admin-muted/60 focus:border-admin-primary/40 focus:outline-none"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] text-admin-muted">Only staff can see these notes.</p>
            <button
              type="button"
              onClick={add}
              disabled={isPending || !draft.trim()}
              className={cn(
                "flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-[#34451F] px-3.5 text-[13px] font-semibold text-[#34451F] transition-colors hover:bg-[#E5EBD8] disabled:pointer-events-none disabled:opacity-50"
              )}
            >
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Add note
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function BookingNoteQuote({ note }: { note: string }) {
  return (
    <div className="p-4 sm:px-5">
      <blockquote className="border-l-2 border-admin-gold pl-3 text-[13px] leading-relaxed break-words whitespace-pre-line text-admin-ink italic">
        {note}
      </blockquote>
    </div>
  );
}
