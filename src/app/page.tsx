import { createClient } from "@/lib/supabase/server";
import { getCompanyInfo } from "@/lib/company-info";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { SmoothScroll } from "@/components/smooth-scroll";
import { HomeHero } from "@/components/home-hero";
import { LiveTicker, MarqueeTicker } from "@/components/marquee-ticker";
import { MarketPill } from "@/components/market-pill";
import { WeekNights } from "@/components/week-nights";
import { SpecialsSection, type SpecialRow } from "@/components/specials-section";
import { MerchandiseSection, type MerchandiseRow } from "@/components/merchandise-section";
import { InstagramStrip, type PromoRow } from "@/components/instagram-strip";
import {
  entryText,
  getEventType,
  serializeEvent,
  BOOKED_BAND_FILTER,
  PUBLIC_EVENT_SELECT,
  type EventRow,
} from "@/lib/events-display";
import Image from "next/image";

export const revalidate = 300;

const HERO_BACKDROP = "/backdrop.jpeg";

export default async function HomePage() {
  const supabase = await createClient();
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const [
    { data: rawEvents },
    { data: rawSpecials },
    { data: rawMerchandise },
    { data: rawPromos },
    info,
  ] = await Promise.all([
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

  const highlightedEvents = ((rawEvents ?? []) as EventRow[])
    .filter((e) => getEventType(e)?.behavior !== "private")
    .map((e) => serializeEvent(e));
  const tonight = highlightedEvents.filter((e) => e.date === todayStr);
  const isTonight = tonight.length > 0;
  const tonightEvents = isTonight ? tonight : highlightedEvents.slice(0, 1);
  const liveTickerItems = tonight.flatMap((e) => [
    e.title,
    e.startTimeLabel ? `${e.startTimeLabel}${e.endTimeLabel ? ` – ${e.endTimeLabel}` : ""}` : null,
    entryText(e),
  ]).filter((x): x is string => Boolean(x));
  const specials = ((rawSpecials ?? []) as SpecialRow[]).filter(
    (s) =>
      (!s.start_date || s.start_date <= todayStr) &&
      (!s.end_date || s.end_date >= todayStr)
  );
  const merchandise = (rawMerchandise ?? []) as MerchandiseRow[];
  const promos = (rawPromos ?? []) as PromoRow[];

  const backdropUrl = HERO_BACKDROP;

  const companyInfo = info;
  const tagline = companyInfo?.tagline?.trim() || null;
  const taglineAccent = companyInfo?.tagline_accent?.trim() || undefined;

  return (
    <main className="relative isolate min-h-dvh w-full bg-canvas pb-24 text-ink-2 antialiased selection:bg-[#FDCC4B] selection:text-[#1a2008]">
      <SmoothScroll />
      <PublicNav currentPath="/" overlay />
      <MarketPill />

      <div className="relative overflow-hidden">
        {backdropUrl && (
          <div className="pointer-events-none absolute inset-0 isolate" aria-hidden="true">
            <Image
              src={backdropUrl}
              alt=""
              fill
              priority
              sizes="100vw"
              className="ad-drift object-cover object-center"
            />
            <div className="absolute inset-0 bg-linear-to-br from-[#7A1F1F]/35 via-[#4A2A14]/25 to-[#26300D]/40 mix-blend-multiply" />
            <div className="absolute inset-0 bg-linear-to-b from-canvas/70 via-canvas/50 via-35% to-canvas" />
          </div>
        )}
        <div className="pointer-events-none absolute -top-40 -left-30 h-130 w-130 rounded-full bg-[#FDCC4B]/10 blur-[120px]" aria-hidden="true" />
        <div className="pointer-events-none absolute top-95 -right-40 h-110 w-110 rounded-full bg-[#7A1F1F]/25 blur-[120px]" aria-hidden="true" />

        <div className="relative z-10 pt-14 sm:pt-16">
          <MarqueeTicker straight />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-400 px-4 pt-6 sm:px-6 sm:pt-10 lg:px-10">
          <HomeHero
            tagline={tagline}
            accentWord={taglineAccent}
            tonightEvents={tonightEvents}
            isTonight={isTonight}
          />
        </div>

        <div className="relative z-10 mt-10 pb-8 sm:mt-14">
          {isTonight && <LiveTicker items={liveTickerItems} />}
        </div>
      </div>

      <div className="-mt-4 space-y-16 sm:-mt-6 sm:space-y-24">
        <WeekNights
          events={highlightedEvents}
          today={today}
          openingHours={companyInfo?.opening_hours ?? null}
        />

        <div className="mx-auto w-full max-w-400 space-y-16 px-4 sm:space-y-24 sm:px-6 lg:px-10">
          {specials.length > 0 && <SpecialsSection specials={specials} />}

          {merchandise.length > 0 && (
            <MerchandiseSection merchandise={merchandise} />
          )}

          <InstagramStrip posts={promos} handle={companyInfo?.instagram ?? null} />

          <PublicFooter info={companyInfo} />
        </div>
      </div>
    </main>
  );
}
