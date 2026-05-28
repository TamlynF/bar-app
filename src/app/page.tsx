import { createClient } from "@/lib/supabase/server";
import { format, startOfMonth, endOfMonth, addMonths } from "date-fns";
import Image from "next/image";
import {
  Calendar,
  Sparkles,
  Music,
  Mic,
  PartyPopper,
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

/** The type colour for an event, from badge_color, falling back to gold. */
function eventBadgeColor(event: EventRow): string {
  const et = getEventType(event);
  return swatchHexFromColor(et?.badge_color) ?? "#FDCC4B";
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

  // All events for the current month (past + future) in one list
  const thisMonthEvents = events.filter((e) => parseDate(e.date) <= monthEnd);

  // The first event on or after today is the "next upcoming"
  const nextEventId = thisMonthEvents.find((e) => e.date >= todayStr)?.id ?? null;

  // Serialize for client component
  const serializedMonthEvents = thisMonthEvents.map((e) => ({
    id: e.id,
    title: e.title,
    date: e.date,
    startTimeLabel: formatTime(e.start_time),
    externalLink: e.external_link,
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
      endTimeLabel: formatTime(e.end_time),
      isActive: e.is_active,
      isFullyBooked: e.is_fully_booked,
      isBookable: e.is_bookable,
      externalLink: e.external_link,
      color: eventBadgeColor(e),
      type: getEventType(e)?.type ?? null,
      subType: getEventType(e)?.sub_type ?? null,
    }));

  const thisMonthLabel = format(today, "MMMM");
  const nextMonthLabel = format(addMonths(today, 1), "MMMM");

  return (
    <main className="min-h-dvh w-full bg-[#1a2008] text-stone-300 selection:bg-[#FDCC4B] selection:text-[#1a2008] antialiased">
      <style
        dangerouslySetInnerHTML={{
          __html: `html, body { background-color: #1a2008 !important; margin: 0; padding: 0; overflow-x: hidden; }`,
        }}
      />

      <PublicNav currentPath="/" />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-[#FDCC4B]/10 blur-[120px] rounded-full" />
          <div className="absolute top-20 right-0 w-[300px] h-[200px] bg-[#7A1F1F]/20 blur-[100px] rounded-full" />
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-4 sm:pb-6 text-center">
          <div className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1 mb-4">
            <span className="relative flex w-1.5 h-1.5">
              <span className="absolute inline-flex w-full h-full bg-[#FDCC4B] rounded-full animate-ping opacity-60" />
              <span className="relative inline-flex w-1.5 h-1.5 bg-[#FDCC4B] rounded-full" />
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-300">
              Regent St &middot; Hinckley
            </span>
          </div>

          <Image
            src="/CompanyName.png"
            alt="Don Fenticas"
            width={500}
            height={130}
            className="w-[80%] max-w-[320px] mx-auto h-auto object-contain drop-shadow-[0_8px_40px_rgba(253,204,75,0.2)] mb-4"
            priority
          />

          <h1 className="text-white font-black text-3xl sm:text-5xl uppercase tracking-tighter leading-[0.95] max-w-2xl mx-auto">
            Live music, quizzes,
            <br />
            <span className="text-[#FDCC4B]">karaoke &amp; more</span>
          </h1>
          <p className="text-stone-400 text-sm sm:text-base font-medium mt-3 max-w-md mx-auto">
            The best nights out in town. Walk-ins welcome, bookings encouraged.
          </p>

          <div className="flex flex-wrap justify-center gap-2 mt-5">
            <VibePill icon={Music} label="Live Bands" />
            <VibePill icon={Mic} label="Karaoke" />
            <VibePill icon={PartyPopper} label="Quiz Nights" />
          </div>
        </div>
      </section>

      {/* SCHEDULE */}
      <section id="schedule" className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <MonthHeader label={thisMonthLabel} />

        <MonthEventList
          events={serializedMonthEvents}
          todayStr={todayStr}
          nextEventId={nextEventId}
        />

        <ScheduleMore events={laterEvents} nextMonthLabel={nextMonthLabel} />

        {events.length > 0 && <ColorKey events={events} />}

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

function MonthHeader({ label }: { label: string }) {
  return (
    <header className="text-center mb-8">
      <div className="inline-flex items-center gap-1.5 bg-[#FDCC4B]/10 border border-[#FDCC4B]/20 rounded-full px-3 py-1 mb-3">
        <Sparkles className="w-3 h-3 text-[#FDCC4B]" />
        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#FDCC4B]">
          What&apos;s On
        </span>
      </div>
      <h2 className="text-white font-black text-5xl sm:text-7xl uppercase tracking-tighter leading-[0.85]">
        {label}
      </h2>
    </header>
  );
}

function VibePill({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1.5">
      <Icon className="w-3 h-3 text-[#FDCC4B]" />
      <span className="text-[10px] font-black uppercase tracking-wide text-stone-200">
        {label}
      </span>
    </span>
  );
}

function ColorKey({ events }: { events: EventRow[] }) {
  const seen = new Map<string, string>();
  for (const e of events) {
    const et = getEventType(e);
    const label = et?.sub_type || et?.type;
    if (label && !seen.has(label)) {
      seen.set(label, eventBadgeColor(e));
    }
  }
  const entries = Array.from(seen.entries());
  if (entries.length === 0) return null;

  return (
    <div className="mt-10 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
      {entries.map(([label, color]) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <span
            className="ev-dot w-2.5 h-2.5 rounded-full"
            style={{ "--key-c": color } as React.CSSProperties}
          />
          <span className="text-stone-400 text-[10px] font-black uppercase tracking-wide">
            {label}
          </span>
        </span>
      ))}
    </div>
  );
}

