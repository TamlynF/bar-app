import { createClient } from "@/lib/supabase/server";
import { format, startOfMonth, endOfMonth, addMonths } from "date-fns";
import { Calendar } from "lucide-react";
import { PublicNav } from "@/components/public-nav";
import { SectionHeading } from "@/components/editorial/section-heading";
import { type FilterTab } from "@/components/editorial/filter-tabs";
import { WhatsOnGrid } from "@/components/whats-on-grid";
import {
  getEventType,
  serializeEvent,
  type BandInfo,
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
  const nextMonthEnd = endOfMonth(addMonths(today, 1));
  const nextMonthEndStr = format(nextMonthEnd, "yyyy-MM-dd");

  const { data: rawEvents } = await supabase
    .from("events")
    .select(
      "id, title, date, start_time, end_time, tagline, image_url, is_active, is_fully_booked, is_bookable, seating_required, payment_amount, external_link, booking_page_url, karaoke_request_url, event_types!inner(name, color), event_subtypes!inner(name, color, behavior, tagline)"
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

  const musicActIds = events
    .filter((e) => getEventType(e)?.behavior === "music_act")
    .map((e) => e.id);

  const bandByEvent = new Map<number, BandInfo>();
  if (musicActIds.length > 0) {
    const { data: bandRows } = await supabase
      .from("band_booking_requests")
      .select("event_id, social_links, video_urls, video_descriptions")
      .in("event_id", musicActIds)
      .eq("status", "booked");

    for (const b of (bandRows ?? []) as {
      event_id: number | null;
      social_links: Record<string, string> | null;
      video_urls: string[] | null;
      video_descriptions: string[] | null;
    }[]) {
      if (b.event_id == null || bandByEvent.has(b.event_id)) continue;
      const socials = b.social_links ?? {};
      const urls = (b.video_urls ?? []).filter(Boolean);
      const descs = b.video_descriptions ?? [];
      bandByEvent.set(b.event_id, {
        socialLinks: {
          instagram: socials.instagram?.trim() || undefined,
          facebook: socials.facebook?.trim() || undefined,
          youtube: socials.youtube?.trim() || undefined,
          tiktok: socials.tiktok?.trim() || undefined,
        },
        videos: urls.map((url, i) => ({ url, description: (descs[i] ?? "").trim() })),
      });
    }
  }

  const toSerialized = (e: EventRow) =>
    serializeEvent(e, bandByEvent.get(e.id) ?? null);

  const serialized = events.map(toSerialized);

  const upcoming = serialized.filter((e) => e.date >= todayStr);
  const past = serialized
    .filter((e) => e.date < todayStr)
    .sort((a, b) => b.date.localeCompare(a.date));

  const tabSeen = new Map<string, string>();
  for (const e of upcoming) {
    if (!e.subType) continue;
    if (!tabSeen.has(e.subType)) tabSeen.set(e.subType, e.color);
  }
  const tabs: FilterTab[] = Array.from(tabSeen.entries()).map(([label, color]) => ({
    key: label,
    label,
    color,
  }));

  const thisMonthLabel = format(today, "MMMM");

  return (
    <main className="relative isolate min-h-dvh w-full overflow-x-clip bg-canvas pb-24 text-ink-2 antialiased selection:bg-[#FDCC4B] selection:text-[#1a2008]">
      <div className="pointer-events-none absolute -top-40 -left-30 h-130 w-130 rounded-full bg-[#FDCC4B]/10 blur-[120px]" aria-hidden="true" />
      <div className="pointer-events-none absolute top-20 -right-40 h-110 w-110 rounded-full bg-[#7A1F1F]/25 blur-[120px]" aria-hidden="true" />

      <PublicNav currentPath="/whats-on" />

      <div className="relative z-10 mx-auto w-full max-w-400 px-4 py-6 sm:px-6 sm:py-10 lg:px-10">
        <SectionHeading eyebrow={`${thisMonthLabel} · The schedule`} title="What's On" />

        {serialized.length > 0 && (
          <WhatsOnGrid upcoming={upcoming} past={past} tabs={tabs} />
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
