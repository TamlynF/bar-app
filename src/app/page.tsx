import { createClient } from "@/lib/supabase/server";
import { getCompanyInfo } from "@/lib/company-info";
import { PublicNav } from "@/components/public-nav";
import { SmoothScroll } from "@/components/smooth-scroll";
import { MarketSection } from "@/components/market-section";
import { PosterHero } from "@/components/poster-hero";
import { NextUpList } from "@/components/next-up-list";
import { LaterTonightStrip } from "@/components/later-tonight-strip";
import { TicketStrip } from "@/components/ticket-strip";
import { SpecialsBand } from "@/components/specials-band";
import { FloorStrip } from "@/components/floor-strip";
import { VisitFooter } from "@/components/visit-footer";
import type { SpecialRow } from "@/components/specials-section";
import type { MerchandiseRow } from "@/components/merchandise-section";
import type { PromoRow } from "@/components/instagram-strip";
import { formatClock, toMinutes } from "@/lib/opening-hours";
import {
  getEventType,
  parseDate,
  serializeEvent,
  BOOKED_BAND_FILTER,
  PUBLIC_EVENT_SELECT,
  type EventRow,
} from "@/lib/events-display";
import { format } from "date-fns";

export const revalidate = 300;

const NEXT_NIGHTS = 3;
const DOW_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function clock(hhmm: string | null | undefined) {
  const m = toMinutes(hhmm);
  return m == null ? null : formatClock(m);
}

export default async function HomePage() {
  const supabase = await createClient();
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  const [{ data: rawEvents }, { data: rawSpecials }, { data: rawMerchandise }, { data: rawPromos }, info] =
    await Promise.all([
      supabase
        .from("events")
        .select(PUBLIC_EVENT_SELECT)
        .eq(BOOKED_BAND_FILTER, "booked")
        .eq("is_active", true)
        .gte("date", todayStr)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(16),
      supabase
        .from("specials")
        .select("id, title, description, badges, image_url, start_date, end_date, days_of_week, display_order, created_at")
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
      supabase
        .from("merchandise")
        .select("id, name, description, image_url, price, display_order")
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .limit(8),
      supabase
        .from("promo_content")
        .select("id, title, description, media_url, media_type, external_url")
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .limit(6),
      getCompanyInfo(),
    ]);

  const events = ((rawEvents ?? []) as EventRow[])
    .filter((e) => getEventType(e)?.behavior !== "private")
    .map((e) => serializeEvent(e));

  const featuredDate = events.find((e) => e.date === todayStr)?.date ?? events[0]?.date ?? null;
  const isTonight = featuredDate === todayStr;
  const nightEvents = featuredDate ? events.filter((e) => e.date === featuredDate) : [];
  const later = featuredDate ? events.filter((e) => e.date > featuredDate) : events;
  const nextDates = Array.from(new Set(later.map((e) => e.date))).slice(0, NEXT_NIGHTS);
  const nextUp = later.filter((e) => nextDates.includes(e.date));
  const rangeLabel =
    nextUp.length > 1
      ? `${format(parseDate(nextUp[0].date), "d MMM")} – ${format(parseDate(nextUp[nextUp.length - 1].date), "d MMM")}`
      : nextUp.length === 1
        ? format(parseDate(nextUp[0].date), "EEEE d MMM")
        : null;

  const hours = info?.opening_hours ?? null;
  const featuredDay = featuredDate ? DOW_KEYS[parseDate(featuredDate).getDay()] : DOW_KEYS[today.getDay()];
  const doorsFor = (date: string) => clock(hours?.[DOW_KEYS[parseDate(date).getDay()]]?.open);
  const doors = clock(hours?.[featuredDay]?.open);
  const todayOpen = clock(hours?.[DOW_KEYS[today.getDay()]]?.open);
  const todayClose = clock(hours?.[DOW_KEYS[today.getDay()]]?.close);
  const openTonight = todayOpen ? `Bar open tonight ${todayOpen}${todayClose ? ` – ${todayClose}` : ""} · walk in` : null;

  const specials = ((rawSpecials ?? []) as SpecialRow[]).filter(
    (s) => (!s.start_date || s.start_date <= todayStr) && (!s.end_date || s.end_date >= todayStr)
  );
  const merchandise = (rawMerchandise ?? []) as MerchandiseRow[];
  const promos = (rawPromos ?? []) as PromoRow[];

  return (
    <main className="relative isolate min-h-dvh w-full bg-canvas pb-24 text-ink-2 antialiased selection:bg-[#FDCC4B] selection:text-[#1a2008] sm:pb-16">
      <SmoothScroll />
      <PublicNav currentPath="/" overlay />

      {nightEvents.length > 0 ? (
        <>
          <PosterHero
            nightEvents={nightEvents}
            isTonight={isTonight}
            doors={doors}
            openTonight={openTonight}
          />
          <LaterTonightStrip
            events={nightEvents.slice(1)}
            isTonight={isTonight}
            dayName={format(parseDate(featuredDate as string), "EEEE")}
          />
        </>
      ) : (
        <section className="flex min-h-100 flex-col items-center justify-center px-6 pt-24 text-center">
          <h1 className="m-0 font-black text-5xl leading-[0.9] tracking-tighter text-ink uppercase">What&apos;s on</h1>
          <p className="mt-4 max-w-sm text-sm text-ink-2">
            Nothing booked yet - {openTonight ? openTonight.toLowerCase() : "check back soon"}.
          </p>
        </section>
      )}

      <div className="mx-auto w-full max-w-400">
        <NextUpList events={nextUp} />
        <TicketStrip events={nextUp} rangeLabel={rangeLabel} doorsFor={doorsFor} />
        <div className="mt-14 hidden px-6 sm:block lg:px-10">
          <MarketSection />
        </div>
        <SpecialsBand specials={specials} today={today} />
        <FloorStrip posts={promos} merchandise={merchandise} instagram={info?.instagram ?? null} />
        <VisitFooter info={info} />
      </div>
    </main>
  );
}
