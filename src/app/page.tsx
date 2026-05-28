import { createClient } from "@/lib/supabase/server";
import { format, isToday, isThisWeek, parseISO } from "date-fns";
import Link from "next/link";
import {
  Calendar,
  Sparkles,
  Music,
  Mic,
  PartyPopper,
  Instagram,
  ChevronRight,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { PublicNav } from "@/components/public-nav";

export const revalidate = 300;

type EventRow = {
  id: number;
  name: string;
  description: string | null;
  starts_at: string;
  ticket_url: string | null;
  type_name: string | null;
  type_color: string | null;
};

export default async function HomePage() {
  const supabase = await createClient();

  const { data: rawEvents } = await supabase
    .from("public_events_view")
    .select("*")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(20);

  const events = (rawEvents ?? []) as EventRow[];

  const nextEvent = events[0];
  const tonightEvents = events.filter((e) => isToday(parseISO(e.starts_at)));
  const thisWeekEvents = events.filter(
    (e) => !isToday(parseISO(e.starts_at)) && isThisWeek(parseISO(e.starts_at), { weekStartsOn: 1 })
  );
  const upcomingEvents = events.filter(
    (e) =>
      !isToday(parseISO(e.starts_at)) &&
      !isThisWeek(parseISO(e.starts_at), { weekStartsOn: 1 })
  );

  return (
    <main className="min-h-dvh w-full bg-[#1a2008] text-stone-300 selection:bg-[#FDCC4B] selection:text-[#1a2008] antialiased">
      <style
        dangerouslySetInnerHTML={{
          __html: `html, body { background-color: #1a2008 !important; margin: 0; padding: 0; overflow-x: hidden; }`,
        }}
      />

      <PublicNav currentPath="/" />

      {/* HERO — the schedule IS the priority. No giant logo word. */}
      <section className="relative overflow-hidden">
        {/* Atmospheric glow */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-[#FDCC4B]/10 blur-[120px] rounded-full" />
          <div className="absolute top-20 right-0 w-[300px] h-[200px] bg-[#7A1F1F]/20 blur-[100px] rounded-full" />
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-4 sm:pb-6 text-center">
          {/* Location pill */}
          <div className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1 mb-4">
            <span className="relative flex w-1.5 h-1.5">
              <span className="absolute inline-flex w-full h-full bg-[#FDCC4B] rounded-full animate-ping opacity-60" />
              <span className="relative inline-flex w-1.5 h-1.5 bg-[#FDCC4B] rounded-full" />
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-300">
              Regent St &middot; Hinckley
            </span>
          </div>

          {/* Tagline — short, confident, no hero wordmark */}
          <h1 className="text-white font-black text-3xl sm:text-5xl uppercase tracking-tighter leading-[0.95] max-w-2xl mx-auto">
            Live music, quizzes,
            <br />
            <span className="text-[#FDCC4B]">karaoke &amp; more</span>
          </h1>
          <p className="text-stone-400 text-sm sm:text-base font-medium mt-3 max-w-md mx-auto">
            The best nights out in town. Walk-ins welcome, bookings encouraged.
          </p>

          {/* Vibe pills */}
          <div className="flex flex-wrap justify-center gap-2 mt-5">
            <VibePill icon={Music} label="Live Bands" />
            <VibePill icon={Mic} label="Karaoke" />
            <VibePill icon={PartyPopper} label="Quiz Nights" />
          </div>

          {/* Featured next event */}
          {nextEvent && (
            <Link
              href="#schedule"
              className="group mt-6 inline-flex items-center gap-4 bg-white/5 border border-[#FDCC4B]/20 hover:border-[#FDCC4B]/50 rounded-2xl px-4 sm:px-5 py-3 sm:py-4 transition-all hover:bg-white/[0.08] max-w-full"
            >
              <div className="shrink-0 w-10 h-10 rounded-xl bg-[#FDCC4B]/10 border border-[#FDCC4B]/30 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-[#FDCC4B]" />
              </div>
              <div className="text-left min-w-0">
                <p className="text-stone-500 text-[10px] font-black uppercase tracking-[0.25em]">
                  {isToday(parseISO(nextEvent.starts_at))
                    ? "Tonight"
                    : `Next — ${format(parseISO(nextEvent.starts_at), "d MMM")}`}
                </p>
                <p className="text-white text-sm sm:text-base font-black mt-1 truncate">
                  {nextEvent.name}
                  <span className="text-stone-500 font-bold ml-2">
                    {format(parseISO(nextEvent.starts_at), "h:mma").toLowerCase()}
                  </span>
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-stone-500 group-hover:text-[#FDCC4B] group-hover:translate-x-0.5 transition-all shrink-0" />
            </Link>
          )}
        </div>
      </section>

      {/* SCHEDULE — the actual content priority */}
      <section id="schedule" className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <header className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 bg-[#FDCC4B]/10 border border-[#FDCC4B]/20 rounded-full px-3 py-1 mb-3">
            <Sparkles className="w-3 h-3 text-[#FDCC4B]" />
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#FDCC4B]">
              What&apos;s On
            </span>
          </div>
          <h2 className="text-white font-black text-3xl sm:text-4xl uppercase tracking-tighter">
            The Schedule
          </h2>
          <p className="text-stone-500 text-xs sm:text-sm font-medium mt-2">
            Live music, quizzes, bingo, themed nights
          </p>
        </header>

        {/* Tonight */}
        {tonightEvents.length > 0 && (
          <div className="mb-8">
            <SectionLabel label="Tonight" accent="neon" />
            <div className="grid gap-3 mt-3">
              {tonightEvents.map((ev) => (
                <EventCard key={ev.id} event={ev} prominent />
              ))}
            </div>
          </div>
        )}

        {/* This week */}
        {thisWeekEvents.length > 0 && (
          <div className="mb-8">
            <SectionLabel label="This Week" />
            <div className="grid gap-3 mt-3">
              {thisWeekEvents.slice(0, 4).map((ev) => (
                <EventCard key={ev.id} event={ev} />
              ))}
            </div>
          </div>
        )}

        {/* Coming up */}
        {upcomingEvents.length > 0 && (
          <div className="mb-2">
            <SectionLabel label="Coming Up" />
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl divide-y divide-white/5 mt-3 overflow-hidden">
              {upcomingEvents.slice(0, 8).map((ev) => (
                <EventRow key={ev.id} event={ev} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
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
              <p className="text-white text-sm font-black truncate">
                @donfenticas
              </p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-stone-400 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
        </a>
      </section>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-4 sm:px-6 pb-10 text-center">
        <div className="flex items-center justify-center gap-4 text-stone-800">
          <div className="h-px w-6 bg-stone-800/50" />
          <span className="text-[9px] font-bold uppercase tracking-[0.4em]">
            Don Fenticas
          </span>
          <div className="h-px w-6 bg-stone-800/50" />
        </div>
        <p className="text-[9px] text-stone-700 uppercase tracking-widest mt-2">
          &copy; {new Date().getFullYear()} &middot; Licensed Venue &middot; Drink Responsibly
        </p>
      </footer>
    </main>
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

function SectionLabel({
  label,
  accent,
}: {
  label: string;
  accent?: "neon" | "default";
}) {
  return (
    <div className="flex items-center gap-2 px-1">
      {accent === "neon" && (
        <span className="relative flex w-1.5 h-1.5">
          <span className="absolute inline-flex w-full h-full bg-[#FF6B35] rounded-full animate-ping opacity-75" />
          <span className="relative inline-flex w-1.5 h-1.5 bg-[#FF6B35] rounded-full" />
        </span>
      )}
      <span
        className={
          accent === "neon"
            ? "text-[10px] font-black uppercase tracking-[0.25em] text-[#FF6B35]"
            : "text-[10px] font-black uppercase tracking-[0.25em] text-stone-500"
        }
      >
        {label}
      </span>
      <div className="flex-1 h-px bg-stone-800/50" />
    </div>
  );
}

function EventCard({
  event,
  prominent = false,
}: {
  event: EventRow;
  prominent?: boolean;
}) {
  const start = parseISO(event.starts_at);
  const cardClass = prominent
    ? "bg-gradient-to-br from-[#FDCC4B]/10 to-transparent border-[#FDCC4B]/30"
    : "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.07]";

  const inner = (
    <div
      className={`group flex items-stretch gap-4 border rounded-2xl p-4 transition-all ${cardClass}`}
    >
      <div className="shrink-0 w-16 text-center flex flex-col items-center justify-center bg-white/5 rounded-xl py-2">
        <p className="text-stone-500 text-[9px] font-black uppercase tracking-widest">
          {format(start, "EEE")}
        </p>
        <p className="text-white text-2xl font-black tabular-nums leading-none mt-1">
          {format(start, "d")}
        </p>
        <p className="text-stone-500 text-[9px] font-bold uppercase mt-0.5">
          {format(start, "MMM")}
        </p>
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        {event.type_name && (
          <p
            className="text-[10px] font-black uppercase tracking-[0.2em] mb-1"
            style={{ color: event.type_color ?? "#FDCC4B" }}
          >
            {event.type_name}
          </p>
        )}
        <p className="text-white text-sm sm:text-base font-black truncate">
          {event.name}
        </p>
        <p className="text-stone-400 text-xs font-bold mt-0.5 tabular-nums">
          {format(start, "h:mma").toLowerCase()}
        </p>
      </div>
      <div className="shrink-0 flex items-center">
        {event.ticket_url ? (
          <ExternalLink className="w-4 h-4 text-stone-500 group-hover:text-[#FDCC4B] transition-colors" />
        ) : (
          <ChevronRight className="w-5 h-5 text-stone-600 group-hover:text-stone-300 group-hover:translate-x-0.5 transition-all" />
        )}
      </div>
    </div>
  );

  return event.ticket_url ? (
    <a href={event.ticket_url} target="_blank" rel="noopener noreferrer">
      {inner}
    </a>
  ) : (
    inner
  );
}

function EventRow({ event }: { event: EventRow }) {
  const start = parseISO(event.starts_at);
  const inner = (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-white/[0.03] transition-colors">
      <div className="shrink-0 w-14">
        <p className="text-[#FDCC4B] text-[10px] font-black uppercase tracking-widest">
          {format(start, "EEE")} {format(start, "d")}
        </p>
      </div>
      <div className="shrink-0 w-1 h-1 bg-stone-700 rounded-full" />
      <div className="flex-1 min-w-0">
        <span className="text-white text-sm font-black truncate">
          {event.name}
        </span>
        <span className="text-stone-500 text-xs font-bold ml-2 tabular-nums">
          {format(start, "h:mma").toLowerCase()}
        </span>
      </div>
      {event.ticket_url && (
        <ExternalLink className="w-3.5 h-3.5 text-stone-600 shrink-0" />
      )}
    </div>
  );
  return event.ticket_url ? (
    <a href={event.ticket_url} target="_blank" rel="noopener noreferrer">
      {inner}
    </a>
  ) : (
    inner
  );
}