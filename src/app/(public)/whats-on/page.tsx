import { createClient } from "@/lib/supabase/server";
import { format, startOfMonth, endOfMonth, addMonths } from "date-fns";
import { Calendar } from "lucide-react";
import { PublicNav } from "@/components/public-nav";
import { SectionHeading } from "@/components/editorial/section-heading";
import { type FilterTab } from "@/components/editorial/filter-tabs";
import { WhatsOnGrid } from "@/components/whats-on-grid";
import { getEventType, parseDate, serializeEvent, type EventRow } from "@/lib/events-display";

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
      "id, title, date, start_time, end_time, is_active, is_fully_booked, is_bookable, payment_amount, external_link, booking_page_url, karaoke_request_url, event_types!inner(name, color), event_subtypes!inner(name, color, behavior)"
    )
    .gte("date", monthStartStr)
    .lte("date", nextMonthEndStr)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(100);

  const events = ((rawEvents ?? []) as EventRow[]).filter(
    (e) =>
      getEventType(e)?.behavior !== "private" &&
      (e.date < todayStr || e.is_active)
  );

  const monthEvents = events.filter((e) => parseDate(e.date) <= monthEnd);
  const serializedMonthEvents = monthEvents.map(serializeEvent);

  // Grid buckets: upcoming (today onward) + past (before today). The grid marks
  // the first upcoming event inline as "NEXT UP" — no separate hero.
  const upcoming = serializedMonthEvents.filter((e) => e.date >= todayStr);
  const past = serializedMonthEvents.filter((e) => e.date < todayStr);
  const nextEventId = upcoming[0]?.id ?? null;

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

  // Future months (beyond this month) — same serialized shape so the grid can
  // render them with the same EventCard, behind a "View {month}" toggle.
  const later = events
    .filter((e) => parseDate(e.date) > monthEnd)
    .map(serializeEvent);

  const thisMonthLabel = format(today, "MMMM");
  const nextMonthLabel = format(addMonths(today, 1), "MMMM");

  return (
    <main className="relative isolate min-h-dvh w-full overflow-hidden bg-canvas pb-24 text-ink-2 antialiased selection:bg-[#FDCC4B] selection:text-[#1a2008]">
      {/* Ambient glow wash across the top — matches the home hero band */}
      <div className="pointer-events-none absolute -top-40 -left-30 h-130 w-130 rounded-full bg-[#FDCC4B]/10 blur-[120px]" aria-hidden="true" />
      <div className="pointer-events-none absolute top-20 -right-40 h-110 w-110 rounded-full bg-[#7A1F1F]/25 blur-[120px]" aria-hidden="true" />

      <PublicNav currentPath="/whats-on" />

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-6 sm:py-10">
        <SectionHeading eyebrow={`${thisMonthLabel} · The schedule`} title="What's On" />

        {/* Search + filterable flip-card grid: past (collapsed, above) →
            "Coming up" (next event marked inline) → next month (collapsed). */}
        {(serializedMonthEvents.length > 0 || later.length > 0) && (
          <WhatsOnGrid
            upcoming={upcoming}
            past={past}
            later={later}
            tabs={tabs}
            nextEventId={nextEventId}
            nextMonthLabel={nextMonthLabel}
          />
        )}

        {events.length === 0 && (
          <div className="rounded-2xl border border-hairline bg-white/3 py-16 text-center">
            <Calendar className="mx-auto mb-3 h-8 w-8 text-ink-2/50" aria-hidden="true" />
            <p className="font-black text-sm tracking-tight text-ink-2 uppercase">
              No Events Scheduled Yet
            </p>
            <p className="mt-1 text-xs text-ink-2/70">Check back soon</p>
          </div>
        )}

        <footer className="mt-16 text-center">
          <div className="flex items-center justify-center gap-4 text-stone-800">
            <div className="h-px w-6 bg-stone-800/50" />
            <span className="text-[9px] font-bold tracking-[0.4em] uppercase">Don Fenticas</span>
            <div className="h-px w-6 bg-stone-800/50" />
          </div>
          <p className="mt-2 text-[9px] tracking-widest text-stone-700 uppercase">
            &copy; {new Date().getFullYear()} &middot; Licensed Venue &middot; Drink Responsibly
          </p>
        </footer>
      </div>
    </main>
  );
}
