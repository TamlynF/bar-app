"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

const CLOSE_DISTANCE = 96;

/* The grey pill at the top of a phone sheet. Dragging it pulls the sheet
   down with the finger and closes it past CLOSE_DISTANCE; a shorter drag
   springs back. Desktop never shows it. */
export function SheetDragHandle({ onClose, className }: { onClose: () => void; className?: string }) {
  const startY = useRef<number | null>(null);
  const sheetRef = useRef<HTMLElement | null>(null);

  const sheetOf = (target: EventTarget | null) =>
    (target as HTMLElement | null)?.closest<HTMLElement>('[data-slot="sheet-content"]') ?? null;

  return (
    <div
      className={cn("flex shrink-0 justify-center pt-2 pb-1 sm:hidden", className)}
      onTouchStart={(event) => {
        startY.current = event.touches[0]?.clientY ?? null;
        sheetRef.current = sheetOf(event.currentTarget);
        if (sheetRef.current) sheetRef.current.style.transition = "none";
      }}
      onTouchMove={(event) => {
        const sheet = sheetRef.current;
        if (startY.current == null || !sheet) return;
        const delta = Math.max(0, (event.touches[0]?.clientY ?? 0) - startY.current);
        sheet.style.transform = `translateY(${delta}px)`;
      }}
      onTouchEnd={(event) => {
        const sheet = sheetRef.current;
        if (startY.current == null || !sheet) return;
        const delta = Math.max(0, (event.changedTouches[0]?.clientY ?? 0) - startY.current);
        sheet.style.transition = "";
        sheet.style.transform = "";
        startY.current = null;
        sheetRef.current = null;
        if (delta > CLOSE_DISTANCE) onClose();
      }}
    >
      <span className="h-1.5 w-10 rounded-full bg-admin-line" aria-hidden="true" />
    </div>
  );
}
