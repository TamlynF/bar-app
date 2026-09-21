"use client";

import Image from "next/image";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Disc3 } from "lucide-react";
import { Waveform } from "@/components/ui/waveform";
import { cn } from "@/lib/utils";
import type { SerializedEvent } from "@/lib/events-display";

function minutes(label: string | null): number | null {
  if (!label) return null;
  const m = label.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[3] === "pm") h += 12;
  return h * 60 + Number(m[2] ?? 0);
}

/* Progress through tonight's set, 0-1, or null before doors. Ends after
   midnight are handled by pushing the end past 24h. */
function progressFor(event: SerializedEvent, now: Date): number | null {
  const start = minutes(event.startTimeLabel);
  if (start == null) return null;
  let end = minutes(event.endTimeLabel) ?? start + 180;
  if (end <= start) end += 24 * 60;
  let cur = now.getHours() * 60 + now.getMinutes();
  if (cur < start && cur + 24 * 60 <= end) cur += 24 * 60;
  if (cur < start) return null;
  return Math.min(1, (cur - start) / (end - start));
}

/* "On the decks": the headline act tonight as a now-playing card - artwork
   turning very slowly on a vinyl, title, act, a progress bar that moves with
   the clock and a live waveform. With nothing on, the house playlist. */
const MINUTE = 60_000;

function subscribeMinute(onChange: () => void) {
  const t = window.setInterval(onChange, MINUTE / 2);
  return () => window.clearInterval(t);
}
const minuteNow = () => Math.floor(Date.now() / MINUTE);
const minuteOnServer = () => null;

export function NowPlaying({ event, isTonight }: { event: SerializedEvent | null; isTonight: boolean }) {
  const minute = useSyncExternalStore(subscribeMinute, minuteNow, minuteOnServer);
  const now = minute == null ? null : new Date(minute * MINUTE);

  const live = Boolean(event && isTonight);
  const progress = live && event && now ? progressFor(event, now) : null;
  const started = progress != null;
  const title = live && event ? event.title : "House playlist";
  const artist = live && event ? [event.subType, event.startTimeLabel].filter(Boolean).join(" · ") : "Don Fenticas selects · all day";
  const status = live ? (started ? "Now playing" : "Up next") : "On the speakers";
  const href = live && event ? `/whats-on/${event.id}` : "/whats-on";

  return (
    <Link
      href={href}
      aria-label={`${status}: ${title}`}
      className="group mx-4 mt-3 flex items-center gap-3.5 rounded-2xl border border-white/10 bg-canvas-2 p-3 transition-[transform,border-color] duration-300 hover:-translate-y-0.5 hover:border-gold/40 active:scale-[0.985] sm:mx-6 md:mx-0 md:mt-8 md:max-w-md"
      style={{ "--ev-c": event?.color ?? "#FDCC4B" } as React.CSSProperties}
    >
      <span className="relative h-16 w-16 shrink-0">
        <span className="ad-vinyl-face ad-np-disc absolute inset-0 rounded-full" aria-hidden="true" />
        <span className="ad-np-art absolute inset-[7%] overflow-hidden rounded-full border border-black/60 bg-canvas">
          {event?.imageUrl && live ? (
            <Image src={event.imageUrl} alt="" fill sizes="64px" className="object-cover" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center bg-linear-to-br from-(--ev-c)/60 to-canvas text-ink" aria-hidden="true">
              <Disc3 className="h-6 w-6" strokeWidth={1.6} />
            </span>
          )}
          <span className="absolute inset-[42%] rounded-full bg-canvas ring-1 ring-black/60" aria-hidden="true" />
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-eyebrow font-semibold text-gold">
          <Waveform bars={5} active={live} className="h-2.5 text-gold" />
          {status}
        </span>
        <span className="mt-1 block truncate font-black text-[15px] leading-tight tracking-tight text-ink uppercase">{title}</span>
        <span className="mt-0.5 block truncate text-meta text-ink-2">{artist}</span>
        <span className="mt-2 block h-1 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
          <span
            className={cn("ad-np-progress block h-full rounded-full bg-gold", !started && "ad-np-idle")}
            style={{ "--np-progress": `${Math.round((progress ?? 0) * 100)}%` } as React.CSSProperties}
          />
        </span>
      </span>

      <Waveform bars={9} active={live} className="h-6 shrink-0 text-ink-2 group-hover:text-gold" barClassName="w-[3px]" />
    </Link>
  );
}
