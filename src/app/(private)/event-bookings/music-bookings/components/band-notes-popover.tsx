"use client";

import React, { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { addBandNote, updateBandNote, deleteBandNote } from "../actions";
import type { BandNote } from "./band-booking-card";

function authorName(note: BandNote): string {
  const a = Array.isArray(note.author) ? note.author[0] : note.author;
  return a?.full_name?.trim() || "Unknown";
}

export default function BandNotesPopover({
  requestId,
  notes,
  editable,
  children,
}: {
  requestId: string;
  notes: BandNote[];
  editable: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = (work: () => Promise<void>, onDone?: () => void) => {
    startTransition(async () => {
      try {
        await work();
        onDone?.();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  };

  const handleAdd = () => {
    if (!draft.trim()) return;
    run(
      () => addBandNote(requestId, draft),
      () => {
        setDraft("");
        toast.success("Note added");
      }
    );
  };

  const handleSaveEdit = (id: string) => {
    const next = edits[id] ?? "";
    if (!next.trim()) return;
    run(
      () => updateBandNote(id, next),
      () => {
        setEdits((e) => {
          const { [id]: _dropped, ...rest } = e;
          return rest;
        });
        toast.success("Note saved");
      }
    );
  };

  const handleDelete = (id: string) => {
    run(
      () => deleteBandNote(id),
      () => {
        setConfirmingId(null);
        toast.success("Note deleted");
      }
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="end"
        className="flex max-h-104 w-80 flex-col rounded-2xl border-2 border-[#E6DFC8] bg-white p-0"
      >
        <div className="flex items-center justify-between gap-2 border-b border-[#E6DFC8] px-4 py-3">
          <span className="font-black text-[10px] tracking-wide text-[#5C4033] uppercase">
            Band Notes
          </span>
          <span className="font-black text-[10px] text-[#5F624F]/70 tabular-nums">
            {notes.length}
          </span>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
          {notes.length === 0 ? (
            <p className="py-4 text-center text-xs font-semibold text-[#5F624F]/60">
              No notes yet
            </p>
          ) : (
            notes.map((note) => {
              const editing = note.id in edits;
              const value = edits[note.id] ?? note.body;
              const dirty = editing && value.trim() !== note.body.trim();
              return (
                <div
                  key={note.id}
                  className="rounded-xl border border-[#E6DFC8] bg-[#F7F4EA] px-3 py-2"
                >
                  {editable ? (
                    <textarea
                      aria-label={`Note by ${authorName(note)}`}
                      value={value}
                      rows={2}
                      onChange={(e) =>
                        setEdits((prev) => ({ ...prev, [note.id]: e.target.value }))
                      }
                      className="w-full resize-none bg-transparent text-[13px] leading-relaxed text-[#1F1F1A] outline-none"
                    />
                  ) : (
                    <p className="text-[13px] leading-relaxed text-[#1F1F1A]">{note.body}</p>
                  )}

                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="truncate text-[10px] font-semibold text-[#5F624F]/70">
                      {authorName(note)} · {format(new Date(note.created_at), "d MMM yyyy")}
                    </span>

                    {editable && (
                      <span className="flex shrink-0 items-center gap-1">
                        {dirty && (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleSaveEdit(note.id)}
                            className="rounded-md bg-[#1B4332] px-2 py-1 font-black text-[9px] tracking-widest text-white uppercase transition-colors hover:bg-[#1B4332]/85 disabled:opacity-50"
                          >
                            Save
                          </button>
                        )}
                        {confirmingId === note.id ? (
                          <>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleDelete(note.id)}
                              className="rounded-md bg-red-600 px-2 py-1 font-black text-[9px] tracking-widest text-white uppercase transition-colors hover:bg-red-700 disabled:opacity-50"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmingId(null)}
                              className="rounded-md px-2 py-1 font-black text-[9px] tracking-widest text-[#5F624F] uppercase hover:bg-[#E6DFC8]"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            title="Delete note"
                            aria-label="Delete note"
                            disabled={isPending}
                            onClick={() => setConfirmingId(note.id)}
                            className="rounded-md p-1 text-[#5F624F]/60 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {editable && (
          <div className="space-y-2 border-t border-[#E6DFC8] px-4 py-3">
            <label className="block">
              <span className="sr-only">New note</span>
              <textarea
                value={draft}
                rows={2}
                placeholder="Add a note about the band..."
                onChange={(e) => setDraft(e.target.value)}
                className="w-full resize-none rounded-xl border border-[#E6DFC8] bg-[#F7F4EA] px-3 py-2 text-[13px] text-[#1F1F1A] transition-all placeholder:text-[#5F624F]/50 focus:border-[#5C4033]/30 focus:outline-none"
              />
            </label>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] leading-snug text-[#5F624F]/70">
                Internal only - never shared with the band.
              </p>
              <button
                type="button"
                disabled={!draft.trim() || isPending}
                onClick={handleAdd}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-lg bg-[#1B4332] px-3 py-2 font-black text-[10px] tracking-widest text-white uppercase transition-colors hover:bg-[#1B4332]/85",
                  "disabled:cursor-not-allowed disabled:opacity-40"
                )}
              >
                {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                Add
              </button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
