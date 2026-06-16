import { createClient } from "@/lib/supabase/server";
import { format, startOfMonth, endOfMonth, addMonths } from "date-fns";
import { Calendar } from "lucide-react";
import { PublicNav } from "@/components/public-nav";
import { ScheduleMore } from "@/components/schedule-more";
import { NextEventHero } from "@/components/next-event-hero";
import { SectionHeading } from "@/components/editorial/section-heading";
import { type FilterTab } from "@/components/editorial/filter-tabs";
import { WhatsOnGrid } from "@/components/whats-on-grid";
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
      "id, title, date, start_time, end_time, is_active, is_fully_booked, is_bookable, external_link, booking_page_url, karaoke_request_url, event_types!inner(name, color), event_subtypes!inner(name, color, behavior)"
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

  // Grid buckets: upcoming (after the hero day) + past (before today).
  const upcoming = serializedMonthEvents.filter(
    (e) => e.date >= todayStr && (!nextEvent || e.date !== nextEvent.date)
  );
  const past = serializedMonthEvents.filter((e) => e.date < todayStr);

  // Subtype filter tabs, built from upcoming + hero (not past), preserving colour.
  const tabSeen = new Map<string, string>();
  for (const e of serializedMonthEvents) {
    if (e.date < todayStr || !e.subType) continue;
    if (!tabSeen.has(e.subType)) tabSeen.set(e.subType, e.color);
  }
  const tabs: FilterTab[] = Array.from(tabSeen.entries()).map(([label, color]) => ({
    key: label,
    label,
    color,
  }));

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

  return (
    <main className="min-h-dvh w-full bg-[#1a2008] text-stone-300 selection:bg-[#FDCC4B] selection:text-[#1a2008] antialiased pb-24">
      <PublicNav currentPath="/whats-on" />

      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-10">
        <SectionHeading eyebrow={`${thisMonthLabel} · The schedule`} title="What's On" />

        {/* Featured "next up" event */}
        {nextEvent && (
          <NextEventHero event={nextEvent} isTonight={isTonight} siblings={heroSiblings} />
        )}

        {/* Filterable card grid + past collapse */}
        {serializedMonthEvents.length > 0 && (
          <WhatsOnGrid upcoming={upcoming} past={past} tabs={tabs} />
        )}

        {/* Next month, revealed on demand */}
        <ScheduleMore events={laterEvents} nextMonthLabel={nextMonthLabel} />

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
