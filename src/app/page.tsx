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
import { NextEventHero } from "@/components/next-event-hero";
import { SpecialsSection, type SpecialRow } from "@/components/specials-section";

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
  booking_page_url: string | null;
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
  return `${displayHour}:${minute}${ampm}`;
}

/** Safely extract the event type from the join (can be array or object) */
function getEventType(event: EventRow): EventTypeJoin | null {
  if (!event.event_types) return null;
  return Array.isArray(event.event_types) ? event.event_types[0] : event.event_types;
}

/**
 * Lift a hex colour toward white until it's bright enough to read as a TITLE
 * on the near-black olive canvas (#1a2008).
 */
function brightenForDark(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  let r = parseInt(h.slice(0, 2), 16);
  let g = parseInt(h.slice(2, 4), 16);
  let b = parseInt(h.slice(4, 6), 16);

  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const TARGET = 165;

  if (lum >= TARGET) return hex;

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

  const monthStart = startOfMonth(today);
  const monthStartStr = format(monthStart, "yyyy-MM-dd");
  const monthEnd = endOfMonth(today);
  const nextMonthEnd = endOfMonth(addMonths(today, 1));
  const nextMonthEndStr = format(nextMonthEnd, "yyyy-MM-dd");

  const [{ data: rawEvents }, { data: rawSpecials }] = await Promise.all([
    supabase
      .from("events")
      .select(
        "id, title, date, start_time, end_time, is_active, is_fully_booked, is_bookable, external_link, booking_page_url, event_types!inner(type, sub_type, type_color, badge_color)"
      )
      .gte("date", monthStartStr)
      .lte("date", nextMonthEndStr)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(100),
    supabase
      .from("specials")
      .select("id, title, description, badges, image_url, start_date, end_date, display_order")
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
  ]);

  const specials = (rawSpecials ?? []) as SpecialRow[];

  const events = ((rawEvents ?? []) as EventRow[]).filter(
    (e) => e.date < todayStr || e.is_active || e.is_fully_booked
  );

  const monthEvents = events.filter((e) => parseDate(e.date) <= monthEnd);

  // Map every month event into the shared serialized shape (now incl. the
  // fields the hero needs: end time + fully-booked flag).
  const serialize = (e: EventRow) => ({
    id: e.id,
    title: e.title,
    date: e.date,
    startTimeLabel: formatTime(e.start_time),
    endTimeLabel: formatTime(e.end_time),
    externalLink: e.external_link,
    isFullyBooked: e.is_fully_booked,
    isBookable: e.is_bookable ?? false,
    bookingPageUrl: e.booking_page_url ?? null,
    color: eventBadgeColor(e),
    subType: getEventType(e)?.sub_type ?? null,
  });

  const serializedMonthEvents = monthEvents.map(serialize);

  // The first event on or after today is the "next upcoming" — promoted to hero.
  const nextEvent =
    serializedMonthEvents.find((e) => e.date >= todayStr) ?? null;
  const isTonight = nextEvent?.date === todayStr;

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
      <PublicNav currentPath="/" />

      {/* Page hero */}
      <header className="relative mt-6 sm:pt-36 pb-2 px-2 flex flex-col items-start text-left overflow-hidden">
        <div className="absolute -top-10 left-0 w-[120%] max-w-2xl h-64 bg-[#FDCC4B]/5 blur-[100px] rounded-[100%] pointer-events-none" />
          <div className="relative z-10 flex flex-col items-start w-full px-10 sm:px-16">        
          <h1
            className="month-title leading-none font-black italic uppercase tracking-tighter text-white drop-shadow-2xl"
            style={{ "--month-fs": "2rem", "--month-fs-sm": "8rem" } as React.CSSProperties}
          >
            {thisMonthLabel}
          </h1>
        <div
            className="at-row flex items-center gap-3 mt-1"
            style={{ "--at-indent": "3.5rem", "--at-indent-sm": "4.8rem" } as React.CSSProperties}
          >
          <span className="text-lg sm:text-2xl italic text-stone-400 font-serif">at</span>
            <Image 
              src="/CompanyName.png"
            alt="Don Fenticas"
              width={300} 
              height={80} 
              className="h-12 sm:h-12 w-auto object-contain drop-shadow-md"
              priority
            />
          </div>
        </div>
        
        {/* Bar Themes Badges - Indie/Rock Vibe */}
        <div className="mt-4 flex gap-2 overflow-x-auto no-scrollbar relative z-10">
          <span className="pill-neon-orange border shrink-0 text-[9px] font-black uppercase tracking-[0.15em] h-10 px-4 flex items-center justify-center rounded-full backdrop-blur cursor-default">
            Live Music
          </span>
          <span className="pill-neon-pink border shrink-0 text-[9px] font-black uppercase tracking-[0.15em] h-10 px-4 flex items-center justify-center rounded-full backdrop-blur cursor-default">
            Indie &amp; Rock
          </span>
          <span className="pill-neon-cyan border shrink-0 text-[9px] font-black uppercase tracking-[0.15em] h-10 px-4 flex items-center justify-center rounded-full backdrop-blur cursor-default">
            DJs
          </span>
          <span className="pill-neon-lime border shrink-0 text-[9px] font-black uppercase tracking-[0.15em] h-10 px-4 flex items-center justify-center rounded-full backdrop-blur cursor-default">
            Karaoke
          </span>
        </div>
      
        <div className="mt-6 w-32 h-[2px] bg-linear-to-r from-transparent via-[#FDCC4B]/20 to-transparent relative z-10" />
      </header>

      <div className="px-2 max-w-3xl mx-auto space-y-6">
      {/* Section 1: Specials */}
      <SpecialsSection specials={specials} />

      {/* Section 2: Events */}
      <section id="schedule" className="max-w-5xl mx-auto px-4 sm:px-6 pb-6 sm:pb-10">
        <div className="flex items-center gap-2.5 mb-4">
          <span className="text-xs font-black uppercase tracking-[0.25em] text-[#FDCC4B]">
            What&apos;s On
          </span>
          <div className="flex-1 h-px bg-[#FDCC4B]/20" />
        </div>

        {/* Hero: the next upcoming event */}
        {nextEvent && <NextEventHero event={nextEvent} isTonight={isTonight} />}

        {/* The rest of the month, split into upcoming (by week) + past (collapsed) */}
        <MonthEventList
          events={serializedMonthEvents}
          todayStr={todayStr}
          excludeId={nextEvent?.id ?? null}
        />

      {/*   <ScheduleMore events={laterEvents} nextMonthLabel={nextMonthLabel} /> */}

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
      </section>
</div>
      {/* Instagram CTA */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-12">
        <a
          href="https://www.instagram.com/donfenticas"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center justify-between gap-4 bg-linear-to-r from-[#7A1F1F]/30 to-[#FDCC4B]/10 border border-white/10 hover:border-[#FDCC4B]/30 rounded-2xl p-4 sm:p-5 transition-all"
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