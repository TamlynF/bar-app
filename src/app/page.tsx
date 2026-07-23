import Link from "next/link";
import { endOfWeek, format } from "date-fns";
import { UtensilsCrossed, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { SmoothScroll } from "@/components/smooth-scroll";
import { HomeHero } from "@/components/home-hero";
import { MarqueeTicker } from "@/components/marquee-ticker";
import { HighlightedEvents } from "@/components/highlighted-events";
import { GalleryPeek, type GalleryPeekItem } from "@/components/gallery-peek";
import { FindUs, type CompanyInfo } from "@/components/find-us";
import { SpecialsSection, type SpecialRow } from "@/components/specials-section";
import { InstagramStrip, type PromoRow } from "@/components/instagram-strip";
import { SectionHeading } from "@/components/editorial/section-heading";
import { getEventType, serializeEvent, type EventRow } from "@/lib/events-display";
import { describeOpenState, shortLocation, type OpeningHours } from "@/lib/opening-hours";
import Image from "next/image";

export const revalidate = 300;

const DEFAULT_TAGLINE = "Live music, indie & rock, DJs and karaoke";

type GalleryRow = {
  id: number;
  title: string | null;
  image_url: string;
  media_type: string;
};

export default async function HomePage() {
  const supabase = await createClient();
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const [
    { data: rawEvents },
    { data: rawSpecials },
    { data: rawGallery },
    { data: rawPromos },
    { data: info },
  ] = await Promise.all([
    supabase
      .from("events")
      .select(
        "id, title, date, start_time, end_time, tagline, image_url, is_active, is_fully_booked, is_bookable, external_link, booking_page_url, karaoke_request_url, event_types!inner(name, color), event_subtypes!inner(name, color, behavior, tagline)"
      )
      .eq("is_active", true)
      .gte("date", todayStr)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(9),
    supabase
      .from("specials")
      .select("id, title, description, badges, image_url, start_date, end_date, days_of_week, display_order")
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
    supabase
      .from("gallery_images")
      .select("id, title, image_url, media_type")
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .limit(12),
    supabase
      .from("promo_content")
      .select("id, title, description, media_url, media_type, external_url")
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .limit(6),
    supabase.from("company_information").select("*").maybeSingle(),
  ]);

  const highlightedEvents = ((rawEvents ?? []) as EventRow[])
    .filter((e) => getEventType(e)?.behavior !== "private")
    .map((e) => serializeEvent(e));
  const featured = highlightedEvents[0] ?? null;
  const isTonight = featured?.date === todayStr;
  const weekEndStr = format(endOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const scheduleEvents = highlightedEvents
    .slice(1)
    .filter((e) => e.date <= weekEndStr);

  const specials = (rawSpecials ?? []) as SpecialRow[];
  const promos = (rawPromos ?? []) as PromoRow[];

  const photos = ((rawGallery ?? []) as GalleryRow[]).filter(
    (g) => g.media_type !== "video"
  );
  const backdropUrl = photos[1]?.image_url ?? null;
  const peekItems: GalleryPeekItem[] = photos
    .slice(0, 8)
    .map((g) => ({ id: g.id, title: g.title, image_url: g.image_url }));

  const companyInfo = (info ?? null) as CompanyInfo;
  const tagline = DEFAULT_TAGLINE;

  const openState = describeOpenState(
    companyInfo?.opening_hours as OpeningHours | null,
    today
  );
  const location = shortLocation(companyInfo?.address);
  const mapsHref = companyInfo?.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(companyInfo.address)}`
    : null;

  return (
    <main className="relative isolate min-h-dvh w-full bg-canvas pb-24 text-ink-2 antialiased selection:bg-[#FDCC4B] selection:text-[#1a2008]">
      <SmoothScroll />
      <PublicNav currentPath="/" overlay />

      <div className="relative overflow-hidden">
        {backdropUrl && (
          <div className="pointer-events-none absolute inset-0 isolate" aria-hidden="true">
            <Image
              src={backdropUrl}
              alt=""
              fill
              sizes="100vw"
              className="scale-105 object-cover grayscale contrast-125"
            />
            <div className="absolute inset-0 bg-linear-to-br from-[#7A1F1F] via-[#4A2A14] to-[#26300D] mix-blend-multiply" />
            <div className="absolute inset-0 bg-linear-to-b from-[#FDCC4B]/35 via-[#FDCC4B]/10 to-transparent mix-blend-overlay" />
            <div className="absolute inset-0 bg-[#1a2008]/55" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_50%_45%,rgba(20,24,10,0.85)_0%,rgba(20,24,10,0.45)_55%,transparent_100%)]" />
            <div className="absolute inset-0 bg-linear-to-b from-black/45 via-transparent to-canvas" />
          </div>
        )}
        <div className="pointer-events-none absolute -top-40 -left-30 h-130 w-130 rounded-full bg-[#FDCC4B]/10 blur-[120px]" aria-hidden="true" />
        <div className="pointer-events-none absolute top-95 -right-40 h-110 w-110 rounded-full bg-[#7A1F1F]/25 blur-[120px]" aria-hidden="true" />

        <div className="relative z-10 mx-auto max-w-5xl px-4 pt-14 sm:pt-16">
          <HomeHero
            tagline={tagline}
            openState={openState}
            location={location}
            mapsHref={mapsHref}
            featured={featured}
            isTonight={isTonight}
          />
        </div>

        <div className="relative z-10 mt-8 sm:mt-12">
          <MarqueeTicker />
        </div>
      </div>

      <div className="mt-6 space-y-16 sm:mt-8 sm:space-y-24">
        <HighlightedEvents events={scheduleEvents} />

        <div className="mx-auto max-w-5xl space-y-16 px-4 sm:space-y-24">
          {specials.length > 0 && <SpecialsSection specials={specials} />}

          <GalleryPeek items={peekItems} />

          <section className="scroll-mt-24">
            <SectionHeading eyebrow="Eat & drink" title="The Menu" action={{ href: "/menu", label: "Full menu" }} />
            <Link
              href="/menu"
              className="group flex items-center gap-4 rounded-2xl border border-hairline bg-canvas-2 p-5 shadow-lg shadow-black/20 transition-all duration-300 hover:border-white/30 hover:bg-white/15 active:scale-[0.99] sm:p-6"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#FDCC4B]/20 bg-[#FDCC4B]/10">
                <UtensilsCrossed className="h-6 w-6 text-[#FDCC4B]" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block font-black text-base tracking-tight text-ink uppercase">
                  Drinks, Cocktails &amp; Snacks
                </span>
                <p className="mt-0.5 text-xs leading-relaxed text-stone-400">
                  Draught, spirits, wine and bar bites — updated regularly.
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-stone-500 transition-all group-hover:translate-x-0.5 group-hover:text-ink" />
            </Link>
          </section>

          <FindUs info={companyInfo} />

          <InstagramStrip posts={promos} handle={companyInfo?.instagram ?? null} />

          <PublicFooter info={companyInfo} />
        </div>
      </div>
    </main>
  );
}
