"use client";

import React, { useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

interface EventItem {
  id: string;
  date: string;
  title: string | null;
  start_time: string | null;
}

function formatTime(t?: string | null) {
  if (!t) return null;
  const [hh, mm] = t.split(":");
  const h = parseInt(hh, 10);
  if (Number.isNaN(h)) return null;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${mm} ${ampm}`;
}

function formatEventLabel(e: EventItem) {
  const dateStr = format(parseISO(e.date), "eee, do MMM yy");
  const time = formatTime(e.start_time);
  return time ? `${dateStr} — ${time}` : dateStr;
}

export default function EventTypeFilter({
  events,
  selectedEventId,
  label,
}: {
  events: EventItem[];
  selectedEventId?: string | null;
  label: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const sorted = [...events].sort((a, b) => b.date.localeCompare(a.date));

  const filtered = query.trim()
    ? sorted.filter(e => formatEventLabel(e).toLowerCase().includes(query.toLowerCase()))
    : sorted;

  const selected = selectedEventId ? events.find(e => e.id === selectedEventId) : null;
  const displayValue = selected ? formatEventLabel(selected) : "";

  const handleSelect = (e: EventItem) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("eventId", e.id);
    router.push(`?${params.toString()}`);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    router.push(`${window.location.pathname}?all=1`);
    setQuery("");
    setOpen(false);
  };

  useEffect(() => {
    const handler = (ev: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(ev.target as Node) &&
        inputRef.current && !inputRef.current.contains(ev.target as Node)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative w-full">
      <div className="flex h-12 items-center gap-3 rounded-xl bg-[#F7F4EA] px-4 sm:h-10 sm:px-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="mb-0.5 font-black text-[10px] leading-none tracking-wide text-[#5F624F]/50 uppercase sm:text-[8px]">
            {label}
          </span>
          <div className="flex items-center gap-1.5">
            <Search className="h-3 w-3 shrink-0 text-[#5F624F]/50" />
            <input
              ref={inputRef}
              type="text"
              value={open ? query : displayValue}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => { setQuery(""); setOpen(true); }}
              onClick={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              placeholder={selected ? displayValue : "All history — type to filter…"}
              className="min-w-0 flex-1 bg-transparent font-black text-sm tracking-tight text-[#1F1F1A] uppercase outline-none placeholder:font-medium placeholder:tracking-normal placeholder:text-[#5F624F]/50 placeholder:normal-case sm:text-xs"
            />
          </div>
        </div>
        {selectedEventId && (
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 rounded-lg p-1 transition-colors hover:bg-[#E6DFC8]"
            aria-label="Clear filter"
          >
            <X className="h-3.5 w-3.5 text-[#5F624F]/50" />
          </button>
        )}
      </div>

      {open && (
        <div
          ref={dropdownRef}
          className="bg-dropdown absolute top-full right-0 left-0 z-9999 mt-1.5 max-h-72 overflow-hidden overflow-y-auto rounded-2xl border border-black/10 shadow-2xl"
        >
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-[11px] font-bold tracking-wider text-[#5F624F] uppercase">
              No events match
            </p>
          ) : filtered.map(event => (
            <button
              key={event.id}
              type="button"
              onMouseDown={e => { e.preventDefault(); handleSelect(event); }}
              className={`flex w-full items-center gap-3 border-b border-black/5 px-4 py-3 text-left transition-colors last:border-0 hover:bg-black/5 ${event.id === selectedEventId ? "bg-black/10" : ""}`}
            >
              <span className="font-black text-[11px] tracking-tight text-[#1F1F1A] uppercase">
                {formatEventLabel(event)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
