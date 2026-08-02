"use client";

import React, { useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

interface QuizEvent {
  id: string;
  date: string;
  title: string | null;
}

function formatEventLabel(event: QuizEvent) {
  const date = format(parseISO(event.date), "eeee, do MMMM yyyy");
  return event.title ? `${date} - ${event.title}` : date;
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
      <div className="flex h-12 items-center gap-3 rounded-xl bg-[#F4F1E8] px-4">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="mb-0.5 font-black text-[10px] leading-none tracking-wide text-[#5E6654]/50 uppercase">
            Quiz Event
          </span>
          <div className="flex items-center gap-1.5">
            <Search className="h-3 w-3 shrink-0 text-[#5E6654]/50" />
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
              placeholder={selectedEvent ? displayValue : "All history - type to filter…"}
              className="min-w-0 flex-1 bg-transparent font-black text-sm tracking-tight text-[#20231A] uppercase outline-none placeholder:font-medium placeholder:tracking-normal placeholder:text-[#5E6654]/50 placeholder:normal-case"
            />
          </div>
        </div>

        {selectedDate && (
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 rounded-lg p-1 transition-colors hover:bg-[#D8D5C8]"
            aria-label="Clear filter"
          >
            <X className="h-3.5 w-3.5 text-[#5E6654]/50" />
          </button>
        )}
      </div>

      {open && (
        <div
          ref={dropdownRef}
          className="bg-dropdown absolute top-full right-0 left-0 z-9999 mt-1.5 max-h-72 overflow-hidden overflow-y-auto rounded-2xl border border-black/10 shadow-2xl"
        >
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-[11px] font-bold tracking-wider text-[#5E6654] uppercase">
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
                className={`flex w-full items-center gap-3 border-b border-black/5 px-4 py-3 text-left transition-colors last:border-0 hover:bg-black/5 ${
                  event.date === selectedDate ? "bg-black/10" : ""
                }`}
              >
                <span className="font-black text-[11px] tracking-tight text-[#20231A] uppercase">
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
