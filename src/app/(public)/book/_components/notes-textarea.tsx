"use client";

import type React from "react";
import { Textarea } from "@/components/ui/textarea";
import { NOTES_MAX_LENGTH } from "@/lib/notes-limit";
import { cn } from "@/lib/utils";

const GROW_CLASS =
  "h-auto max-h-60 min-h-28 resize-none overflow-y-auto leading-relaxed shadow-none md:text-sm [scrollbar-color:rgb(255_255_255/0.2)_transparent] [scrollbar-width:thin]";

/* A booking form's free-text notes: shadcn's Textarea, growing with what is
   typed up to a limit, with the field's icon pinned to the first line and a
   character count once something has been written. The form passes its own
   input classes so each booking page keeps its look. */
export function NotesTextarea({
  icon,
  value,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Textarea>, "value"> & { icon: React.ReactNode; value: string }) {
  const full = value.length >= NOTES_MAX_LENGTH;
  return (
    <div>
      <div className="group relative">
        <div className="pointer-events-none absolute top-3.5 left-0 flex pl-3.5">{icon}</div>
        <Textarea value={value} maxLength={NOTES_MAX_LENGTH} className={cn(className, GROW_CLASS)} {...props} />
      </div>
      {value.length > 0 && (
        <p className={cn("mt-1 text-right text-xs tabular-nums", full ? "text-gold" : "text-stone-500")}>
          {value.length}/{NOTES_MAX_LENGTH}
        </p>
      )}
    </div>
  );
}
