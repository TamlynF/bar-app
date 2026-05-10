"use client";

import React, { useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarDays, Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

interface QuizEvent {
  id: string;
  date: string;
  title: string | null;
}

function formatEventLabel(event: QuizEvent) {
  const date = format(parseISO(event.date), "eeee, do MMMM yyyy");
  return event.title ? `${date} — ${event.title}` : date;
}

export default function QuizEventFilter({
  events,
  selectedDate,
}: {
  events: QuizEvent[];
  selectedDate?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const sorted = [...events].sort((a, b) => b.date.localeCompare(a.date));

  const filtered = query.trim()
    ? sorted.filter((e) => {
        const label = formatEventLabel(e).toLowerCase();
        return label.includes(query.toLowerCase());
      })
    : sorted;

  const selectedEvent = selectedDate
    ? events.find((e) => e.date === selectedDate)
    : null;

  const displayValue = selectedEvent ? formatEventLabel(selectedEvent) : "";

  const handleSelect = (event: QuizEvent) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", event.date);
    params.set("eventId", event.id);
    router.push(`?${params.toString()}`);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    router.push(window.location.pathname);
    setQuery("");
    setOpen(false);
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative w-full">
      {/* Input row */}
      <div className="flex items-center gap-3 h-12 px-4 bg-[#F7F4EA] rounded-xl">
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-[10px] font-black uppercase tracking-wide text-[#5F624F]/50 leading-none mb-0.5">
            Quiz Event
          </span>
          <div className="flex items-center gap-1.5">
            <Search className="w-3 h-3 text-[#5F624F]/50 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={open ? query : displayValue}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => {
                setQuery("");
                setOpen(true);
              }}
              onClick={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              placeholder={selectedEvent ? displayValue : "All history — type to filter…"}
              className="flex-1 min-w-0 bg-transparent text-sm font-black text-[#1F1F1A] uppercase tracking-tight outline-none placeholder:text-[#5F624F]/50 placeholder:normal-case placeholder:font-medium placeholder:tracking-normal"
            />
          </div>
        </div>

        {selectedDate && (
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 p-1 rounded-lg hover:bg-[#E6DFC8] transition-colors"
            aria-label="Clear filter"
          >
            <X className="w-3.5 h-3.5 text-[#5F624F]/50" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div
          ref={dropdownRef}
          className="absolute left-0 right-0 top-full mt-1.5 bg-dropdown rounded-2xl shadow-2xl z-9999 overflow-hidden border border-black/10 max-h-72 overflow-y-auto"
        >
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-[11px] font-bold text-[#5F624F] uppercase tracking-wider">
              No events match
            </p>
          ) : (
            filtered.map((event) => (
              <button
                key={event.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(event);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-black/5 transition-colors border-b border-black/5 last:border-0 ${
                  event.date === selectedDate ? "bg-black/10" : ""
                }`}
              >
                <span className="text-[11px] font-black uppercase tracking-tight text-[#1F1F1A]">
                  {formatEventLabel(event)}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
