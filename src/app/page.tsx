import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getEventSpace } from "@/lib/update-fully-booked";
import { getCompanyInfo } from "@/lib/company-info";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { SmoothScroll } from "@/components/smooth-scroll";
import { RevealOnScroll } from "@/components/reveal-on-scroll";
import { HomeSkeleton } from "@/components/home-skeleton";
import { GrainOverlay } from "@/components/ui/grain-overlay";
import { Reveal } from "@/components/animations/reveal";
import { MarqueeTicker } from "@/components/marquee-ticker";
import { HomeHero } from "@/components/home/home-hero";
import { quizBookingHref } from "@/lib/quiz-booking-link";
import { ComingUpMonths } from "@/components/home/coming-up-months";
import { DealsStrip } from "@/components/home/deals-strip";
import { MerchGrid } from "@/components/home/merch-grid";
import { GalleryStrip } from "@/components/home/gallery-strip";
import { InstagramStrip } from "@/components/home/instagram-strip";
import { InstallAppCard } from "@/components/home/install-app-card";
import { INSTAGRAM_PROFILE_URL, loadInstagramFeed } from "@/lib/instagram-feed";
import { instagramUrl } from "@/lib/company-info";
import { loadGalleryGroups } from "@/lib/gallery-data";
import { HomeFindUs } from "@/components/home/home-find-us";
import type { SpecialRow } from "@/components/specials-section";
import type { MerchandiseRow } from "@/components/merchandise-section";
import { taglineItems } from "@/lib/tagline-ticker";
import {
  getEventType,
  serializeEvent,
  BOOKED_BAND_FILTER,
  PUBLIC_EVENT_SELECT,
  type EventRow,
} from "@/lib/events-display";
import { endOfMonth, format } from "date-fns";

export const revalidate = 300;

const SCHEDULE_EVENTS = 12;

/* Weekly nights (quiz, karaoke) are shown in the hero's weekly strip, so the
   dated schedule only carries one-off nights. */
const WEEKLY_BEHAVIORS = new Set(["quiz", "karaoke"]);

async function HomeContent() {
  const supabase = await createClient();
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  const [{ data: rawEvents }, { data: rawSpecials }, { data: rawMerchandise }, galleryGroups, info, quizUrl, instagramPosts] =
    await Promise.all([
      supabase
        .from("events")
        .select(PUBLIC_EVENT_SELECT)
        .eq(BOOKED_BAND_FILTER, "booked")
        .eq("is_active", true)
        .gte("date", todayStr)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(24),
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
      loadGalleryGroups(supabase),
      getCompanyInfo(),
      quizBookingHref(supabase, today),
      loadInstagramFeed(),
    ]);

  const karaokeUrl =
    ((rawEvents ?? []) as EventRow[]).map((e) => serializeEvent(e)).find((e) => e.isKaraoke && e.karaokeRequestUrl)
      ?.karaokeRequestUrl ?? null;
  const karaokeTonightEvent = ((rawEvents ?? []) as EventRow[])
    .map((e) => serializeEvent(e))
    .find((e) => e.isKaraoke && e.date === todayStr);
  const karaokeTonight = karaokeTonightEvent ? { url: karaokeTonightEvent.karaokeRequestUrl } : null;

  const events = ((rawEvents ?? []) as EventRow[])
    .filter((e) => {
      const behavior = getEventType(e)?.behavior;
      return behavior !== "private" && !(behavior && WEEKLY_BEHAVIORS.has(behavior));
    })
    .map((e) => serializeEvent(e))
    .filter((e) => !e.isKaraoke)
    .slice(0, SCHEDULE_EVENTS);

  const featured = events[0] ?? null;
  const featuredSpace = featured?.isBookable ? await getEventSpace(supabase, featured) : null;
  const monthEndStr = format(endOfMonth(today), "yyyy-MM-dd");
  const monthEvents = events.filter((e) => e.date <= monthEndStr);
  const specials = ((rawSpecials ?? []) as SpecialRow[]).filter(
    (s) => (!s.start_date || s.start_date <= todayStr) && (!s.end_date || s.end_date >= todayStr)
  );
  const merchandise = (rawMerchandise ?? []) as MerchandiseRow[];
  const tickerItems = taglineItems(info?.tagline);
  const hasMap = Boolean(process.env.GOOGLE_MAPS_API_KEY && info?.address);

  return (
    <>
      <PublicNav currentPath="/" />
      <MarqueeTicker items={tickerItems} />

      <HomeHero
        featured={featured}
        featuredSpace={featuredSpace}
        today={today}
        hours={info?.opening_hours}
        karaokeUrl={karaokeUrl}
        quizUrl={quizUrl}
        karaokeTonight={karaokeTonight}
      />

      <div className="mx-auto flex w-full max-w-400 flex-col gap-12 px-4 pt-10 sm:px-6 lg:gap-16 lg:px-10 lg:pt-14">
        <Reveal index={0}>
          <ComingUpMonths events={monthEvents} monthLabel={format(today, "MMMM")} />
        </Reveal>
        <Reveal index={1}>
          <DealsStrip specials={specials} />
        </Reveal>
        <InstallAppCard />
        <Reveal index={2}>
          <GalleryStrip groups={galleryGroups} />
        </Reveal>
        <Reveal index={3}>
          <InstagramStrip posts={instagramPosts} profileUrl={instagramUrl(info?.instagram) ?? INSTAGRAM_PROFILE_URL} />
        </Reveal>
        <Reveal index={4}>
          <MerchGrid items={merchandise} />
        </Reveal>
        <Reveal index={5}>
          <HomeFindUs info={info} hasMap={hasMap} />
        </Reveal>
      </div>

      <div className="mx-auto mt-12 w-full max-w-400 px-4 sm:px-6 lg:mt-16 lg:px-10">
        <PublicFooter />
      </div>
      <RevealOnScroll />
    </>
  );
}

export default function HomePage() {
  return (
    <main className="relative isolate min-h-dvh w-full bg-canvas pb-[calc(env(safe-area-inset-bottom)+4.5rem)] text-ink-2 antialiased selection:bg-gold selection:text-on-gold sm:pb-16">
      <SmoothScroll />
      <GrainOverlay fixed />
      <Suspense fallback={<HomeSkeleton />}>
        <HomeContent />
      </Suspense>
    </main>
  );
}
