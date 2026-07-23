import Link from "next/link";
import { UtensilsCrossed, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PublicNav } from "@/components/public-nav";
import { SmoothScroll } from "@/components/smooth-scroll";
import { HomeHero } from "@/components/home-hero";
import { MarqueeTicker } from "@/components/marquee-ticker";
import { HighlightedEvents } from "@/components/highlighted-events";
import { GalleryPeek, type GalleryPeekItem } from "@/components/gallery-peek";
import { FindUs, type CompanyInfo } from "@/components/find-us";
import { SpecialsSection, type SpecialRow } from "@/components/specials-section";
import { SectionHeading } from "@/components/editorial/section-heading";
import { getEventType, serializeEvent, type EventRow } from "@/lib/events-display";

export const revalidate = 300;

const DEFAULT_TAGLINE =
  "Live music, indie & rock, DJs and karaoke — your local late-night bar.";

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
    supabase.from("company_information").select("*").maybeSingle(),
  ]);

  const highlightedEvents = ((rawEvents ?? []) as EventRow[])
    .filter((e) => getEventType(e)?.behavior !== "private")
    .map((e) => serializeEvent(e));
  const featured = highlightedEvents[0] ?? null;
  const isTonight = featured?.date === todayStr;
  const scheduleEvents = highlightedEvents.slice(1);

  const specials = (rawSpecials ?? []) as SpecialRow[];

  const photos = ((rawGallery ?? []) as GalleryRow[]).filter(
    (g) => g.media_type !== "video"
  );
  const peekItems: GalleryPeekItem[] = photos
    .slice(0, 8)
    .map((g) => ({ id: g.id, title: g.title, image_url: g.image_url }));

  const companyInfo = (info ?? null) as CompanyInfo;
  const tagline = DEFAULT_TAGLINE;

  const todayName = today
    .toLocaleDateString("en-GB", { weekday: "long" })
    .toLowerCase();
  const todayHours = ((companyInfo?.opening_hours ?? {}) as Record<
    string,
    { open?: string; close?: string }
  >)[todayName];
  const openLabel =
    todayHours?.open && todayHours?.close
      ? `Open today · til ${todayHours.close}`
      : "Live music & late nights";

  const sections = [
    { id: "whats-on", label: "What's On", show: true },
    { id: "specials", label: "Specials", show: specials.length > 0 },
    { id: "gallery", label: "Gallery", show: peekItems.length > 0 },
    { id: "find-us", label: "Find Us", show: companyInfo != null },
  ].filter((s) => s.show);

  return (
    <main className="relative isolate min-h-dvh w-full bg-canvas pb-24 text-ink-2 antialiased selection:bg-[#FDCC4B] selection:text-[#1a2008]">
      <SmoothScroll />
      <PublicNav currentPath="/" />

      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-40 -left-30 h-130 w-130 rounded-full bg-[#FDCC4B]/10 blur-[120px]" aria-hidden="true" />
        <div className="pointer-events-none absolute top-95 -right-40 h-110 w-110 rounded-full bg-[#7A1F1F]/25 blur-[120px]" aria-hidden="true" />

        <div className="relative z-10 mx-auto max-w-5xl px-4 pt-4 sm:pt-6">
          <HomeHero
            tagline={tagline}
            openLabel={openLabel}
            featured={featured}
            isTonight={isTonight}
          />
        </div>

        <div className="relative z-10">
          <MarqueeTicker />
        </div>
      </div>

      <nav
        aria-label="Page sections"
        className="sticky top-14 z-30 border-y border-hairline bg-canvas/85 backdrop-blur-xl sm:top-16"
      >
        <div className="no-scrollbar mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 py-3">
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="inline-flex h-9 shrink-0 items-center rounded-full border border-hairline bg-canvas-2 px-4 font-black text-[11px] tracking-wide text-stone-400 uppercase transition-colors hover:bg-white/10 hover:text-ink"
            >
              {s.label}
            </a>
          ))}
        </div>
      </nav>

      <div className="mx-auto mt-12 max-w-5xl space-y-16 px-4 sm:mt-16 sm:space-y-24">
        <HighlightedEvents events={scheduleEvents} />

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

        <footer className="pt-4 text-center">
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
