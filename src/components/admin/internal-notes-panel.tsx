"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { ChevronDown, Loader2, Maximize2, MessageSquare, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { attempt } from "@/lib/attempt";

export type InternalNote = {
  id: string;
  body: string;
  created_at: string;
  author?: { full_name: string | null } | { full_name: string | null }[] | null;
};

const COLLAPSED_COUNT = 5;

const WIDGET_SHADOW =
  "shadow-[0_1px_0_rgba(32,35,26,0.08),0_10px_20px_-12px_rgba(32,35,26,0.45)] transition-shadow hover:shadow-[0_1px_0_rgba(32,35,26,0.08),0_14px_24px_-12px_rgba(32,35,26,0.5)]";

function authorName(note: InternalNote): string {
  const a = Array.isArray(note.author) ? note.author[0] : note.author;
  return a?.full_name?.trim() || "Unknown";
}

function stamp(iso: string): string {
  return format(new Date(iso), "d MMM yyyy, HH:mm");
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong.";
}

function NoteDetail({ body, byline }: { body: string; byline: string }) {
  return (
    <>
      <p className="max-h-72 overflow-y-auto text-[13px] leading-relaxed break-words whitespace-pre-line text-admin-ink">
        {body}
      </p>
      <p className="mt-2 border-t border-admin-line pt-2 text-[12px] text-admin-muted">{byline}</p>
    </>
  );
}

export function BookingNoteWidget({
  note,
  title,
  author,
  createdAt,
}: {
  note: string;
  title: string;
  author?: string | null;
  createdAt?: string | null;
}) {
  const byline = [author?.trim() || "Applicant", createdAt ? stamp(createdAt) : null].filter(Boolean).join(" · ");
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-[#C3D8EA] bg-admin-info-bg", WIDGET_SHADOW)}>
      <div className="flex items-center gap-2 border-b border-[#C3D8EA] bg-[#D8E7F3] px-3 py-1.5 sm:px-4 sm:py-2">
        <MessageSquare className="h-4 w-4 shrink-0 text-admin-info" aria-hidden="true" />
        <span className="flex-1 text-[13px] font-bold text-admin-ink">{title}</span>
        <span className="text-[11px] font-semibold text-admin-info">Read only</span>
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            title="Read in full"
            aria-label={`Read the full ${title.toLowerCase()}: ${note}`}
            className="group flex min-h-11 w-full items-start gap-2 py-2 pr-3 pl-3 text-left transition-colors hover:bg-[#DFEBF5] focus-visible:bg-[#DFEBF5] focus-visible:outline-none sm:min-h-10 sm:pl-4"
          >
            <span className="line-clamp-2 flex-1 text-[13px] leading-relaxed break-words text-admin-ink">{note}</span>
            <Maximize2
              className="mt-1 h-3.5 w-3.5 shrink-0 text-admin-muted transition-colors group-hover:text-admin-ink"
              aria-hidden="true"
            />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 rounded-2xl border border-admin-line bg-white p-3 sm:w-96">
          <p className="mb-2 text-[13px] font-bold text-admin-ink">{title}</p>
          <NoteDetail body={note} byline={byline} />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function TeamNoteRow({
  note,
  editable,
  busy,
  onSave,
  onDelete,
}: {
  note: InternalNote;
  editable: boolean;
  busy: boolean;
  onSave: (body: string, done: () => void) => void;
  onDelete: (done: () => void) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [text, setText] = useState(note.body);
  const byline = `${authorName(note)} · ${stamp(note.created_at)}`;

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) {
      setEditing(false);
      setConfirming(false);
    }
  }

  return (
    <li className="border-b border-[#EED891]">
      <Popover open={open} onOpenChange={changeOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title={byline}
            aria-label={`Open note: ${note.body}`}
            className="group flex min-h-11 w-full items-center gap-2 pr-3 pl-3 text-left transition-colors hover:bg-[#FCEFC2] focus-visible:bg-[#FCEFC2] focus-visible:outline-none sm:min-h-10 sm:pl-4"
          >
            <span className="min-w-0 flex-1 truncate text-[13px] text-admin-ink">{note.body}</span>
            <Maximize2
              className="h-3.5 w-3.5 shrink-0 text-admin-muted transition-colors group-hover:text-admin-ink"
              aria-hidden="true"
            />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 rounded-2xl border border-admin-line bg-white p-3 sm:w-96">
          {editing ? (
            <textarea
              aria-label="Edit note"
              value={text}
              rows={4}
              autoFocus
              onChange={(e) => setText(e.target.value)}
              className="w-full resize-none rounded-xl border border-admin-line bg-admin-card px-3 py-2 text-[13px] leading-relaxed text-admin-ink outline-none focus:border-admin-primary/40"
            />
          ) : (
            <NoteDetail body={note.body} byline={byline} />
          )}
          {editable && (
            <div className="mt-3 flex items-center justify-end gap-2">
              {editing ? (
                <>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="h-9 rounded-xl border border-[#D8D5C8] px-3 text-[13px] font-semibold text-[#5E6654] transition-colors hover:bg-[#ECE9DE]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={busy || !text.trim() || text.trim() === note.body.trim()}
                    onClick={() => onSave(text.trim(), () => changeOpen(false))}
                    className="flex h-9 items-center gap-1.5 rounded-xl bg-[#34451F] px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#283719] disabled:opacity-50"
                  >
                    {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Save
                  </button>
                </>
              ) : confirming ? (
                <>
                  <span className="mr-auto text-[12px] font-semibold text-admin-error">Delete this note?</span>
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className="h-9 rounded-xl border border-[#D8D5C8] px-3 text-[13px] font-semibold text-[#5E6654] transition-colors hover:bg-[#ECE9DE]"
                  >
                    Keep
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onDelete(() => changeOpen(false))}
                    className="flex h-9 items-center gap-1.5 rounded-xl bg-[#B33A32] px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#9a312a] disabled:opacity-50"
                  >
                    {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Delete
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setConfirming(true)}
                    className="h-9 rounded-xl px-3 text-[13px] font-semibold text-[#B33A32] transition-colors hover:bg-admin-error-bg"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setText(note.body);
                      setEditing(true);
                    }}
                    className="h-9 rounded-xl border border-[#34451F] px-3.5 text-[13px] font-semibold text-[#34451F] transition-colors hover:bg-[#E5EBD8]"
                  >
                    Edit
                  </button>
                </>
              )}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </li>
  );
}

export function InternalNotesPanel({
  notes,
  editable,
  title = "Team notes",
  placeholder = "Add a note for the team…",
  onAdd,
  onUpdate,
  onDelete,
}: {
  notes: InternalNote[];
  editable: boolean;
  title?: string;
  placeholder?: string;
  onAdd: (body: string) => Promise<void>;
  onUpdate: (id: string, body: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();
  const [showAll, setShowAll] = useState(false);

  const ordered = [...notes].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const overflowing = ordered.length > COLLAPSED_COUNT;
  const shown = showAll || !overflowing ? ordered : ordered.slice(-COLLAPSED_COUNT);

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
    if (!text || isPending) return;
    run(
      () => onAdd(text),
      () => setDraft("")
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-[#EED891] bg-[#FFF8DD]", WIDGET_SHADOW)}>
      <div className="flex items-center gap-2 border-b border-[#EED891] bg-[#FCE9A6] px-3 py-1.5 sm:px-4 sm:py-2">
        <StickyNote className="h-4 w-4 shrink-0 text-[#9A5B00]" aria-hidden="true" />
        <span className="flex-1 text-[13px] font-bold text-admin-ink">{title}</span>
        <span className="text-[11px] font-semibold text-[#9A5B00]">
          Staff only{editable && <span className="max-sm:hidden"> · click a line to type</span>}
        </span>
      </div>

      {ordered.length > 0 && (
        <ul>
          {shown.map((note) => (
            <TeamNoteRow
              key={note.id}
              note={note}
              editable={editable}
              busy={isPending}
              onSave={(body, done) =>
                run(
                  () => onUpdate(note.id, body),
                  () => {
                    done();
                    toast.success("Note saved");
                  }
                )
              }
              onDelete={(done) =>
                run(
                  () => onDelete(note.id),
                  () => {
                    done();
                    toast.success("Note deleted");
                  }
                )
              }
            />
          ))}
        </ul>
      )}

      {editable ? (
        <div className="flex items-center gap-2 pr-3 pl-3 sm:pl-4">
          <input
            type="text"
            aria-label={`New ${title.toLowerCase()} entry`}
            value={draft}
            maxLength={2000}
            disabled={isPending}
            placeholder={ordered.length === 0 ? "No notes yet. Click here to type…" : placeholder}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            onBlur={add}
            className="min-h-11 min-w-0 flex-1 bg-transparent py-2 text-[13px] sm:min-h-10 text-admin-ink outline-none placeholder:text-admin-muted/70"
          />
          {isPending && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#9A5B00]" aria-label="Saving note" />}
        </div>
      ) : (
        ordered.length === 0 && <p className="px-4 py-2.5 text-[13px] text-admin-muted">No notes yet.</p>
      )}

      {overflowing && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          className="flex min-h-11 w-full items-center justify-center gap-1 border-t border-[#EED891] bg-[#FCEFC2] px-4 text-[12px] font-bold text-[#9A5B00] transition-colors hover:bg-[#FCE9A6] focus-visible:bg-[#FCE9A6] focus-visible:outline-none sm:min-h-8"
        >
          {showAll ? "View less" : `View all ${ordered.length} notes`}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showAll && "rotate-180")} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
