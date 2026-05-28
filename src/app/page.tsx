import { createClient } from "@/lib/supabase/server";
import { format, startOfMonth, endOfMonth, addMonths } from "date-fns";
import Image from "next/image";
import {
  Calendar,
  Instagram,
  ArrowRight,
} from "lucide-react";
import { PublicNav } from "@/components/public-nav";
import { swatchHexFromColor } from "@/lib/event-type-colors";
import { ScheduleMore } from "@/components/schedule-more";
import { MonthEventList } from "@/components/month-event-list";

export const revalidate = 300;

export type EventTypeJoin = {
  type: string;
  sub_type: string;
  type_color: string | null;
  badge_color: string | null;
};

export type EventRow = {
  id: number;
  title: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  is_active: boolean;
  is_fully_booked: boolean;
  is_bookable: boolean;
  external_link: string | null;
  event_types: EventTypeJoin | EventTypeJoin[];
};

/** Parse a YYYY-MM-DD date string without timezone shift */
function parseDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00");
}

/** Format a time string like "20:00:00+00" to "8pm" or "8:30pm" */
function formatTime(time: string | null): string | null {
  if (!time) return null;
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const minute = m ?? "00";
  const ampm = hour >= 12 ? "pm" : "am";
  const displayHour = hour % 12 || 12;
  return minute === "00" ? `${displayHour}${ampm}` : `${displayHour}:${minute}${ampm}`;
}

/** Safely extract the event type from the join (can be array or object) */
function getEventType(event: EventRow): EventTypeJoin | null {
  if (!event.event_types) return null;
  return Array.isArray(event.event_types) ? event.event_types[0] : event.event_types;
}

/**
 * Lift a hex colour toward white until it's bright enough to read as a TITLE
 * on the near-black olive canvas (#1a2008). The poster could use mid-tone
 * colours because it sat on a bright yellow background; on dark we need the
 * text itself to clear WCAG, so we raise luminance while keeping the hue.
 *
 * Returns the original if it's already bright enough.
 */
function brightenForDark(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  let r = parseInt(h.slice(0, 2), 16);
  let g = parseInt(h.slice(2, 4), 16);
  let b = parseInt(h.slice(4, 6), 16);

  // Perceived luminance (0–255)
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const TARGET = 165; // empirically reads cleanly on #1a2008

  if (lum >= TARGET) return hex;

  // Mix toward white by the deficit ratio
  const t = Math.min(0.7, (TARGET - lum) / 255 + 0.25);
  r = Math.round(r + (255 - r) * t);
  g = Math.round(g + (255 - g) * t);
  b = Math.round(b + (255 - b) * t);

  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** The (brightened) type colour for an event, from badge_color, falling back to gold. */
function eventBadgeColor(event: EventRow): string {
  const et = getEventType(event);
  const base = swatchHexFromColor(et?.badge_color) ?? "#FDCC4B";
  return brightenForDark(base);
}

export default async function HomePage() {
  const supabase = await createClient();
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  // Fetch from start of current month through end of next month
  const monthStart = startOfMonth(today);
  const monthStartStr = format(monthStart, "yyyy-MM-dd");
  const monthEnd = endOfMonth(today);
  const nextMonthEnd = endOfMonth(addMonths(today, 1));
  const nextMonthEndStr = format(nextMonthEnd, "yyyy-MM-dd");

  const { data: rawEvents } = await supabase
    .from("events")
    .select(
      "id, title, date, start_time, end_time, is_active, is_fully_booked, is_bookable, external_link, event_types!inner(type, sub_type, type_color, badge_color)"
    )
    .gte("date", monthStartStr)
    .lte("date", nextMonthEndStr)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(100);

  // Keep past events regardless of is_active.
  // For today/future: only include if is_active=true or is_fully_booked=true.
  const events = ((rawEvents ?? []) as EventRow[]).filter(
    (e) => e.date < todayStr || e.is_active || e.is_fully_booked
  );

  // All events in the current calendar month (past + upcoming)
  const monthEvents = events.filter((e) => parseDate(e.date) <= monthEnd);

  // The first event on or after today is the "next upcoming"
  const nextEventId = monthEvents.find((e) => e.date >= todayStr)?.id ?? null;

  // Serialize all month events for the client component
  const serializedMonthEvents = monthEvents.map((e) => ({
    id: e.id,
    title: e.title,
    date: e.date,
    startTimeLabel: formatTime(e.start_time),
    externalLink: e.external_link,
    isFullyBooked: e.is_fully_booked,
    color: eventBadgeColor(e),
    subType: getEventType(e)?.sub_type ?? null,
  }));

  // Events past this month → "View [Next Month]" reveal
  const laterEvents = events
    .filter((e) => parseDate(e.date) > monthEnd)
    .map((e) => ({
      id: e.id,
      title: e.title,
      date: e.date,
      startTimeLabel: formatTime(e.start_time),
      externalLink: e.external_link,
      color: eventBadgeColor(e),
      subType: getEventType(e)?.sub_type ?? null,
    }));

  const thisMonthLabel = format(today, "MMMM");
  const nextMonthLabel = format(addMonths(today, 1), "MMMM");

  // Build the colour key from upcoming events only (deduped by label)
  const keySeen = new Map<string, string>();
  for (const e of events) {
    if (e.date < todayStr) continue;
    const et = getEventType(e);
    const label = et?.sub_type || et?.type;
    if (label && !keySeen.has(label)) keySeen.set(label, eventBadgeColor(e));
  }
  const colorKey = Array.from(keySeen.entries()).map(([label, color]) => ({
    label,
    color,
  }));

  return (
    <main className="min-h-dvh w-full bg-[#1a2008] text-stone-300 selection:bg-[#FDCC4B] selection:text-[#1a2008] antialiased">
      <style
        dangerouslySetInnerHTML={{
          __html: `html, body { background-color: #1a2008 !important; margin: 0; padding: 0; overflow-x: hidden; }`,
        }}
      />

      <PublicNav currentPath="/" />

      {/* SCHEDULE */}
      <section id="schedule" className="max-w-5xl mx-auto px-4 sm:px-6 pt-2 sm:pt-6 pb-6 sm:pb-10">
        <header className="text-center mb-5 sm:mb-8">
          <Image
            src="/CompanyName.png"
            alt="Don Fenticas"
            width={500}
            height={130}
            className="w-[55%] max-w-[200px] sm:max-w-[280px] mx-auto h-auto object-contain drop-shadow-[0_8px_40px_rgba(253,204,75,0.2)] mb-2"
            priority
          />
          <p className="text-stone-500 text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] mb-1">
            Live music &middot; Quizzes &middot; Karaoke
          </p>
          <h2 className="text-white font-black text-4xl sm:text-6xl uppercase tracking-tighter leading-[0.85]">
            {thisMonthLabel}
          </h2>
        </header>

        <MonthEventList
          events={serializedMonthEvents}
          todayStr={todayStr}
          nextEventId={nextEventId}
        />

        <ScheduleMore events={laterEvents} nextMonthLabel={nextMonthLabel} />

        {colorKey.length > 0 && <ColorKey entries={colorKey} />}

        {events.length === 0 && (
          <div className="text-center py-16 bg-white/[0.03] border border-white/5 rounded-2xl">
            <Calendar className="w-8 h-8 text-stone-700 mx-auto mb-3" />
            <p className="text-stone-500 font-black text-sm uppercase tracking-tight">
              No Events Scheduled Yet
            </p>
            <p className="text-stone-600 text-xs mt-1">Check back soon</p>
          </div>
        )}
      </section>

      {/* Instagram CTA */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-12">
        <a
          href="https://www.instagram.com/donfenticas"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center justify-between gap-4 bg-gradient-to-r from-[#7A1F1F]/30 to-[#FDCC4B]/10 border border-white/10 hover:border-[#FDCC4B]/30 rounded-2xl p-4 sm:p-5 transition-all"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0 w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <Instagram className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-stone-500 text-[10px] font-black uppercase tracking-[0.25em]">
                Follow Us
              </p>
              <p className="text-white text-sm font-black truncate">@donfenticas</p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-stone-400 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
        </a>
      </section>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-4 sm:px-6 pb-10 text-center">
        <div className="flex items-center justify-center gap-4 text-stone-800">
          <div className="h-px w-6 bg-stone-800/50" />
          <span className="text-[9px] font-bold uppercase tracking-[0.4em]">Don Fenticas</span>
          <div className="h-px w-6 bg-stone-800/50" />
        </div>
        <p className="text-[9px] text-stone-700 uppercase tracking-widest mt-2">
          &copy; {new Date().getFullYear()} &middot; Licensed Venue &middot; Drink Responsibly
        </p>
      </footer>
    </main>
  );
}

function ColorKey({ entries }: { entries: { label: string; color: string }[] }) {
  return (
    <div className="mt-10 pt-6 border-t border-white/[0.06]">
      <p className="text-center text-[10px] font-black uppercase tracking-[0.25em] text-stone-600 mb-4">
        Event Types
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 max-w-md mx-auto">
        {entries.map(({ label, color }) => (
          <span key={label} className="inline-flex items-center gap-2 min-w-0">
            <span
              className="ev-dot shrink-0 w-2.5 h-2.5 rounded-full"
              style={{ "--key-c": color } as React.CSSProperties}
            />
            <span className="text-stone-400 text-[10px] font-black uppercase tracking-wide truncate">
              {label}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}