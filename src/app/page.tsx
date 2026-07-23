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
import Image from "next/image";

export const revalidate = 300;

const HERO_BACKDROP = "/pexels-ikevinmoon-17895798.jpg";

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
        "id, title, date, start_time, end_time, tagline, image_url, is_active, is_fully_booked, is_bookable, payment_amount, external_link, booking_page_url, karaoke_request_url, event_types!inner(name, color), event_subtypes!inner(name, color, behavior, tagline)"
      )
      .eq("is_active", true)
      .gte("date", todayStr)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(9),
    supabase
      .from("specials")
      .select("id, title, description, badges, image_url, start_date, end_date, days_of_week, display_order, created_at")
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
  const tonight = highlightedEvents.filter((e) => e.date === todayStr);
  const isTonight = tonight.length > 0;
  const tonightEvents = isTonight ? tonight : highlightedEvents.slice(0, 1);
  const heroIds = new Set(tonightEvents.map((e) => e.id));
  const weekEndStr = format(endOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const scheduleEvents = highlightedEvents.filter(
    (e) => !heroIds.has(e.id) && e.date <= weekEndStr
  );

  const specials = ((rawSpecials ?? []) as SpecialRow[]).filter(
    (s) =>
      (!s.start_date || s.start_date <= todayStr) &&
      (!s.end_date || s.end_date >= todayStr)
  );
  const promos = (rawPromos ?? []) as PromoRow[];

  const photos = ((rawGallery ?? []) as GalleryRow[]).filter(
    (g) => g.media_type !== "video"
  );
  const backdropUrl = HERO_BACKDROP;
  const peekItems: GalleryPeekItem[] = photos
    .slice(0, 8)
    .map((g) => ({ id: g.id, title: g.title, image_url: g.image_url }));

  const companyInfo = (info ?? null) as CompanyInfo;
  const tagline = companyInfo?.tagline?.trim() || null;
  const taglineAccent = companyInfo?.tagline_accent?.trim() || undefined;

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
              priority
              sizes="100vw"
              className="scale-105 object-cover object-center brightness-115"
            />
            <div className="absolute inset-0 bg-linear-to-br from-[#7A1F1F]/35 via-[#4A2A14]/25 to-[#26300D]/40 mix-blend-multiply" />
            <div className="absolute inset-0 bg-linear-to-b from-[#FDCC4B]/12 to-transparent mix-blend-overlay" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_58%_52%_at_50%_45%,rgba(20,24,10,0.5)_0%,rgba(20,24,10,0.12)_55%,transparent_100%)]" />
            <div className="absolute inset-0 bg-linear-to-b from-black/20 via-transparent to-canvas" />
          </div>
        )}
        <div className="pointer-events-none absolute -top-40 -left-30 h-130 w-130 rounded-full bg-[#FDCC4B]/10 blur-[120px]" aria-hidden="true" />
        <div className="pointer-events-none absolute top-95 -right-40 h-110 w-110 rounded-full bg-[#7A1F1F]/25 blur-[120px]" aria-hidden="true" />

        <div className="relative z-10 mx-auto max-w-5xl px-4 pt-14 sm:pt-16">
          <HomeHero
            tagline={tagline}
            accentWord={taglineAccent}
            tonightEvents={tonightEvents}
            isTonight={isTonight}
          />
        </div>

        <div className="relative z-10 mt-10 pb-8 sm:mt-14">
          <MarqueeTicker />
        </div>
      </div>

      <div className="-mt-4 space-y-16 sm:-mt-6 sm:space-y-24">
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
