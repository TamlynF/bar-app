"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { COUNTRY_CODES } from "@/lib/country-codes";

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

  const TEN_ROWS = 10 * 34 + 8; // ~10 option rows + list padding
  const maxH = rect
    ? Math.min(TEN_ROWS, Math.max(160, window.innerHeight - rect.bottom - 16))
    : TEN_ROWS;

  return (
    <div className="group relative w-24 shrink-0">
      <span className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-3.5">
        <Flag className={cn("h-4 w-4 transition-colors duration-200", open ? "text-[#fdcc4b]" : "text-(--ev-fg,#57534e)")} />
      </span>
      <button
        ref={btnRef}
        type="button"
        title="Country Code"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full cursor-pointer rounded-2xl border bg-black/40 py-4 pr-2 pl-11 text-center text-sm font-bold text-white tabular-nums transition-all duration-300",
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
          className="fixed top-(--y) left-(--x) z-100 max-h-(--mh) w-max min-w-(--w) overflow-y-scroll rounded-2xl border border-white/15 bg-[#26300D] py-1 shadow-2xl [scrollbar-color:rgba(255,255,255,0.4)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/40 [&::-webkit-scrollbar-track]:bg-transparent"
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
                  "block w-full px-5 py-2 text-center text-xs font-bold tracking-wide whitespace-nowrap transition-colors",
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
