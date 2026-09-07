"use client";

import { CalendarPlus, Share2, Check } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { SerializedEvent } from "@/lib/events-display";

/* "8:00pm" / "10:30am" -> [20, 0] */
function parseLabel(label: string | null): [number, number] | null {
  if (!label) return null;
  const m = label.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[3] === "pm") h += 12;
  return [h, Number(m[2] ?? 0)];
}
const pad = (n: number) => String(n).padStart(2, "0");
function stamp(date: string, hm: [number, number]) {
  return `${date.replace(/-/g, "")}T${pad(hm[0])}${pad(hm[1])}00`;
}

function buildIcs(event: SerializedEvent, venue: string) {
  const start = parseLabel(event.startTimeLabel) ?? [19, 0];
  let end = parseLabel(event.endTimeLabel);
  let endDate = event.date;
  if (!end) end = [Math.min(start[0] + 3, 23), start[1]];
  else if (end[0] < start[0]) {
    // finishes after midnight
    const d = new Date(`${event.date}T00:00:00`);
    d.setDate(d.getDate() + 1);
    endDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  const url = typeof window !== "undefined" ? `${window.location.origin}/whats-on/${event.id}` : "";
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Don Fenticas//Events//EN",
    "BEGIN:VEVENT",
    `UID:df-event-${event.id}@donfenticas`,
    `DTSTART:${stamp(event.date, start)}`,
    `DTEND:${stamp(endDate, end)}`,
    `SUMMARY:${event.title.replace(/[,;]/g, "\\$&")}`,
    `LOCATION:${venue}`,
    `DESCRIPTION:${[event.subType, url].filter(Boolean).join(" · ")}`,
    `URL:${url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/* Two quiet icon actions for an event row: add to calendar (.ics) and share
   (Web Share API, falling back to copying the link). */
export function EventActions({
  event,
  venue = "Don Fenticas, Hinckley",
  className,
}: {
  event: SerializedEvent;
  venue?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const addToCalendar = () => {
    const blob = new Blob([buildIcs(event, venue)], { type: "text/calendar;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `${event.title.replace(/[^\w]+/g, "-").toLowerCase()}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 1000);
  };

  const share = async () => {
    const url = `${window.location.origin}/whats-on/${event.id}`;
    const text = `${event.title} at Don Fenticas${event.startTimeLabel ? ` · ${event.startTimeLabel}` : ""}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: event.title, text, url });
        return;
      } catch {
        /* cancelled */
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  };

  const btn =
    "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/12 text-ink-2 transition-colors hover:border-gold/50 hover:text-gold active:scale-95";

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <button type="button" onClick={addToCalendar} aria-label={`Add ${event.title} to your calendar`} className={btn}>
        <CalendarPlus className="h-4 w-4" aria-hidden="true" />
      </button>
      <button type="button" onClick={share} aria-label={copied ? "Link copied" : `Share ${event.title}`} className={btn}>
        {copied ? <Check className="h-4 w-4 text-[#6EE7B7]" aria-hidden="true" /> : <Share2 className="h-4 w-4" aria-hidden="true" />}
      </button>
    </span>
  );
}
