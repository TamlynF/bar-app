import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCompanyInfo } from "@/lib/company-info";
import { PublicNav } from "@/components/public-nav";
import { SmoothScroll } from "@/components/smooth-scroll";
import { RevealOnScroll } from "@/components/reveal-on-scroll";
import { HomeSkeleton } from "@/components/home-skeleton";
import { GrainOverlay } from "@/components/ui/grain-overlay";
import { NowPlaying } from "@/components/home/now-playing";
import { Reveal } from "@/components/animations/reveal";
import { MarketSection } from "@/components/market-section";
import { PosterHero } from "@/components/poster-hero";
import { DateSleeves } from "@/components/home/date-sleeves";
import { LaterTonightStrip } from "@/components/later-tonight-strip";
import { HomeMarketTicker } from "@/components/home-market-ticker";
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

const CAROUSEL_EVENTS = 8;
const DOW_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function clock(hhmm: string | null | undefined) {
  const m = toMinutes(hhmm);
  return m == null ? null : formatClock(m);
}

async function HomeContent() {
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

  const hours = info?.opening_hours ?? null;
  const featuredDay = featuredDate ? DOW_KEYS[parseDate(featuredDate).getDay()] : DOW_KEYS[today.getDay()];
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
    <>
      <PublicNav currentPath="/" overlay ticker={false} />

      {nightEvents.length > 0 ? (
        <>
          <PosterHero
            nightEvents={nightEvents}
            isTonight={isTonight}
            doors={doors}
            openTonight={openTonight}
          />
          <HomeMarketTicker />
          <LaterTonightStrip
            events={nightEvents.slice(1)}
            isTonight={isTonight}
            dayName={format(parseDate(featuredDate as string), "EEEE")}
          />
          <NowPlaying event={nightEvents[0]} isTonight={isTonight} />
        </>
      ) : (
        <section className="flex min-h-100 flex-col items-center justify-center px-6 pt-24 text-center">
          <h1 className="m-0 font-black text-5xl leading-[0.9] tracking-tighter text-ink uppercase">What&apos;s on</h1>
          <p className="mt-4 max-w-sm text-sm text-ink-2">
            Nothing booked yet - {openTonight ? openTonight.toLowerCase() : "check back soon"}.
          </p>
        </section>
      )}

      {nightEvents.length === 0 && (
        <>
          <HomeMarketTicker />
          <NowPlaying event={null} isTonight={false} />
        </>
      )}

      <div className="mx-auto w-full max-w-400">
        <DateSleeves events={later.slice(0, CAROUSEL_EVENTS)} />
        <div className="mt-14 hidden px-6 sm:block lg:px-10">
          <MarketSection />
        </div>
        <Reveal index={0}>
          <SpecialsBand specials={specials} today={today} />
        </Reveal>
        <Reveal index={1}>
          <FloorStrip posts={promos} merchandise={merchandise} instagram={info?.instagram ?? null} />
        </Reveal>
        <Reveal index={2}>
          <VisitFooter info={info} />
        </Reveal>
      </div>
      <RevealOnScroll />
    </>
  );
}

export default function HomePage() {
  return (
    <main className="relative isolate min-h-dvh w-full bg-canvas pb-[calc(env(safe-area-inset-bottom)+4.5rem)] text-ink-2 antialiased selection:bg-[#FDCC4B] selection:text-[#1a2008] sm:pb-16">
      <SmoothScroll />
      <GrainOverlay fixed />
      <Suspense fallback={<HomeSkeleton />}>
        <HomeContent />
      </Suspense>
    </main>
  );
}
