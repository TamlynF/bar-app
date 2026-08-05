"use client";

import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export default function MusicActNotesPopover({
  value,
  onSave,
  children,
}: {
  value: string;
  // Resolves when the note has landed. Editing a record that is not saved yet
  // just parks it in form state, so this is not always a round trip.
  onSave: (notes: string) => void | Promise<void>;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  // Reopening reads the record again rather than showing whatever was typed and
  // abandoned last time.
  const handleOpenChange = (next: boolean) => {
    if (next) setDraft(value);
    setOpen(next);
  };

  const dirty = draft.trim() !== value.trim();

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 overflow-hidden rounded-2xl border-2 border-admin-line bg-admin-card p-0"
      >
        <span className="block border-b border-admin-line bg-admin-line px-4 py-2.5 text-[12px] font-semibold text-admin-primary">
          Internal notes
        </span>

        <div className="space-y-2 px-4 py-3">
          <label className="block">
            <span className="sr-only">Internal notes</span>
            <textarea
              value={draft}
              rows={5}
              placeholder="Private notes about this act…"
              onChange={(e) => setDraft(e.target.value)}
              className="w-full resize-y rounded-xl border border-admin-line bg-admin-surface px-3 py-2 text-[13px] leading-relaxed text-admin-ink outline-none placeholder:text-admin-muted/50 focus:border-admin-primary/40"
            />
          </label>

          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] leading-snug text-admin-muted">
              Internal only - never shown on the website.
            </p>
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={handleSave}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-admin-primary px-3 py-2 text-[11px] font-semibold text-white transition-colors hover:bg-admin-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving && <Loader2 className="h-3 w-3 animate-spin" />}
              Save
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
