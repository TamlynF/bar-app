"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { COUNTRY_CODES } from "@/lib/country-codes";

/**
 * Country dialing-code picker for the booking forms. The closed field shows only
 * the code (e.g. "+44"); the open list shows "ISO +code" (e.g. "GB +44") so the
 * duplicate codes (several "+1"s) stay distinguishable. Both are centre-aligned.
 *
 * The menu renders through a portal with fixed positioning so it escapes the
 * booking card's `overflow-hidden` instead of being clipped.
 */
export function CountryCodeSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
    };
    place();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Show ~10 codes at a time and scroll for the rest, but never exceed the space
  // below the field so a field near the viewport bottom scrolls instead of clipping.
  const TEN_ROWS = 10 * 34 + 8; // ~10 option rows + list padding
  const maxH = rect
    ? Math.min(TEN_ROWS, Math.max(160, window.innerHeight - rect.bottom - 16))
    : TEN_ROWS;

  return (
    <div className="relative group shrink-0 w-24">
      <span className="pointer-events-none absolute inset-y-0 left-0 pl-3.5 flex items-center z-10">
        <Flag className={cn("w-4 h-4 transition-colors duration-200", open ? "text-[#fdcc4b]" : "text-(--ev-fg,#57534e)")} />
      </span>
      <button
        ref={btnRef}
        type="button"
        title="Country Code"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full bg-black/40 border rounded-2xl pl-11 pr-2 py-4 text-white text-center text-sm font-bold tabular-nums cursor-pointer transition-all duration-300",
          open ? "border-[#fdcc4b] ring-1 ring-[#fdcc4b]" : "border-white/10"
        )}
      >
        {value}
      </button>

      {open && rect && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          aria-label="Country dialing codes"
          style={{ "--x": `${rect.left}px`, "--y": `${rect.bottom + 6}px`, "--w": `${rect.width}px`, "--mh": `${maxH}px` } as React.CSSProperties}
          className="fixed left-(--x) top-(--y) z-100 min-w-(--w) w-max max-h-(--mh) overflow-y-scroll rounded-2xl border border-white/15 bg-[#26300D] shadow-2xl py-1 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.4)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/40"
        >
          {COUNTRY_CODES.map((c) => {
            const isSel = c.code === value;
            return (
              <button
                key={c.iso + c.code}
                type="button"
                role="option"
                aria-selected={isSel}
                onClick={() => {
                  onChange(c.code);
                  setOpen(false);
                }}
                className={cn(
                  "block w-full text-center px-5 py-2 text-xs font-bold tracking-wide whitespace-nowrap transition-colors",
                  isSel ? "bg-[#fdcc4b] text-[#26300D]" : "text-stone-200 hover:bg-white/10"
                )}
              >
                {c.iso} {c.code}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
