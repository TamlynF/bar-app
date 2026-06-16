import { createClient } from "@/lib/supabase/server";
import { format, startOfMonth, endOfMonth, addMonths } from "date-fns";
import { Calendar } from "lucide-react";
import { PublicNav } from "@/components/public-nav";
import { ScheduleMore } from "@/components/schedule-more";
import { MonthEventList } from "@/components/month-event-list";
import { NextEventHero } from "@/components/next-event-hero";
import {
  parseDate,
  formatTime,
  getEventType,
  eventBadgeColor,
  serializeEvent,
  type EventRow,
} from "@/lib/events-display";

export const revalidate = 300;

export const metadata = {
  title: "What's On | Don Fenticas",
  description: "The full schedule of quizzes, live music, DJs, karaoke and more at Don Fenticas.",
};

export default async function WhatsOnPage() {
  const supabase = await createClient();
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const monthStart = startOfMonth(today);
  const monthStartStr = format(monthStart, "yyyy-MM-dd");
  const monthEnd = endOfMonth(today);
  const nextMonthEnd = endOfMonth(addMonths(today, 1));
  const nextMonthEndStr = format(nextMonthEnd, "yyyy-MM-dd");

  const { data: rawEvents } = await supabase
    .from("events")
    .select(
      "id, title, date, start_time, end_time, is_active, is_fully_booked, is_bookable, external_link, booking_page_url, karaoke_request_url, event_types!inner(name, color), event_subtypes!inner(name, color, is_karaoke)"
    )
    .gte("date", monthStartStr)
    .lte("date", nextMonthEndStr)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(100);

  const events = ((rawEvents ?? []) as EventRow[]).filter(
    (e) => e.date < todayStr || e.is_active || e.is_fully_booked
  );

  const monthEvents = events.filter((e) => parseDate(e.date) <= monthEnd);
  const serializedMonthEvents = monthEvents.map(serializeEvent);

  // The first event on or after today is the "next upcoming" — promoted to hero.
  const nextEvent = serializedMonthEvents.find((e) => e.date >= todayStr) ?? null;
  const isTonight = nextEvent?.date === todayStr;

  const heroSiblings = nextEvent
    ? serializedMonthEvents.filter(
        (e) => e.date === nextEvent.date && e.id !== nextEvent.id
      )
    : [];

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
    <main className="min-h-dvh w-full bg-[#1a2008] text-stone-300 selection:bg-[#FDCC4B] selection:text-[#1a2008] antialiased pb-24">
      <PublicNav currentPath="/whats-on" />

      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
        {/* Page header — standard public pattern, H1 is the page purpose */}
        <header className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-1.5 bg-[#FDCC4B]/10 border border-[#FDCC4B]/20 rounded-full px-3 py-1 mb-3">
            <Calendar className="w-3 h-3 text-[#FDCC4B]" />
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#FDCC4B]">
              What&apos;s On &middot; {thisMonthLabel}
            </span>
          </div>
          <h1 className="text-white font-black text-3xl sm:text-4xl uppercase tracking-tighter">
            What&apos;s On
          </h1>
          <p className="text-stone-400 text-sm font-medium mt-2">
            Quizzes, live music, DJs, karaoke and more &mdash; the full schedule
          </p>
        </header>

        {/* Hero: the next upcoming event */}
        {nextEvent && (
          <NextEventHero event={nextEvent} isTonight={isTonight} siblings={heroSiblings} />
        )}

        {/* The rest of the month, split into upcoming (by week) + past (collapsed) */}
        <MonthEventList
          events={serializedMonthEvents}
          todayStr={todayStr}
          excludeDate={nextEvent?.date ?? null}
        />

        {/* Next month, revealed on demand */}
        <ScheduleMore events={laterEvents} nextMonthLabel={nextMonthLabel} />

        {colorKey.length > 0 && <ColorKey entries={colorKey} />}

        {events.length === 0 && (
          <div className="text-center py-16 bg-white/3 border border-white/5 rounded-2xl">
            <Calendar className="w-8 h-8 text-stone-700 mx-auto mb-3" />
            <p className="text-stone-500 font-black text-sm uppercase tracking-tight">
              No Events Scheduled Yet
            </p>
            <p className="text-stone-600 text-xs mt-1">Check back soon</p>
          </div>
        )}

        <footer className="mt-16 text-center">
          <div className="flex items-center justify-center gap-4 text-stone-800">
            <div className="h-px w-6 bg-stone-800/50" />
            <span className="text-[9px] font-bold uppercase tracking-[0.4em]">Don Fenticas</span>
            <div className="h-px w-6 bg-stone-800/50" />
          </div>
          <p className="text-[9px] text-stone-700 uppercase tracking-widest mt-2">
            &copy; {new Date().getFullYear()} &middot; Licensed Venue &middot; Drink Responsibly
          </p>
        </footer>
      </div>
    </main>
  );
}

function ColorKey({ entries }: { entries: { label: string; color: string }[] }) {
  return (
    <div className="mt-10 pt-6 border-t border-white/6">
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
