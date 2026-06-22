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
import { serializeEvent, type EventRow } from "@/lib/events-display";

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
        "id, title, date, start_time, end_time, tagline, is_active, is_fully_booked, is_bookable, external_link, booking_page_url, karaoke_request_url, event_types!inner(name, color), event_subtypes!inner(name, color, behavior, tagline)"
      )
      .eq("is_active", true)
      .gte("date", todayStr)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(6),
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

  const highlightedEvents = ((rawEvents ?? []) as EventRow[]).map(serializeEvent);
  // The soonest event headlines the hero ("on tonight" if it's today); the rest
  // fill the schedule list below.
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
  const description = (info as { description?: string | null } | null)?.description;
  const tagline = DEFAULT_TAGLINE;

  // Live "open" pill: today's hours if we have them, else an evergreen line.
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

  // Section anchors for the sticky sub-nav (only those with content).
  const sections = [
    { id: "whats-on", label: "What's On", show: true },
    { id: "specials", label: "Specials", show: specials.length > 0 },
    { id: "gallery", label: "Gallery", show: peekItems.length > 0 },
    { id: "find-us", label: "Find Us", show: companyInfo != null },
  ].filter((s) => s.show);

  return (
    <main className="min-h-dvh w-full bg-canvas text-ink-2 selection:bg-[#FDCC4B] selection:text-[#1a2008] antialiased pb-24">
      <SmoothScroll />
      <PublicNav currentPath="/" />

      <div className="max-w-5xl mx-auto px-4 pt-4 sm:pt-6">
        <HomeHero
          tagline={tagline}
          openLabel={openLabel}
          featured={featured}
          isTonight={isTonight}
        />
      </div>

      <div className="max-w-5xl mx-auto px-4">
        <MarqueeTicker />
      </div>

      {/* Sticky section sub-nav (awwwards-style category bar) */}
      <nav
        aria-label="Page sections"
        className="sticky top-14 sm:top-16 z-30 bg-canvas/85 backdrop-blur-xl border-y border-hairline"
      >
        <div className="max-w-5xl mx-auto px-4 flex gap-2 overflow-x-auto no-scrollbar py-3">
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="shrink-0 inline-flex items-center h-9 px-4 rounded-full text-[11px] font-black uppercase tracking-wide bg-canvas-2 text-stone-400 border border-hairline hover:text-ink hover:bg-white/10 transition-colors"
            >
              {s.label}
            </a>
          ))}
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 space-y-16 sm:space-y-24 mt-12 sm:mt-16">
        <HighlightedEvents events={scheduleEvents} />

        {specials.length > 0 && <SpecialsSection specials={specials} />}

        <GalleryPeek items={peekItems} />

        {/* Menu teaser */}
        <section className="scroll-mt-24">
          <SectionHeading eyebrow="Eat & drink" title="The Menu" action={{ href: "/menu", label: "Full menu" }} />
          <Link
            href="/menu"
            className="group flex items-center gap-4 bg-canvas-2 hover:bg-white/15 border border-hairline hover:border-white/30 rounded-2xl p-5 sm:p-6 shadow-lg shadow-black/20 transition-all duration-300 active:scale-[0.99]"
          >
            <div className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center bg-[#FDCC4B]/10 border border-[#FDCC4B]/20">
              <UtensilsCrossed className="w-6 h-6 text-[#FDCC4B]" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="block text-ink font-black text-base uppercase tracking-tight">
                Drinks, Cocktails &amp; Snacks
              </span>
              <p className="text-stone-400 text-xs leading-relaxed mt-0.5">
                Draught, spirits, wine and bar bites — updated regularly.
              </p>
            </div>
            <ArrowRight className="shrink-0 w-4 h-4 text-stone-500 group-hover:text-ink group-hover:translate-x-0.5 transition-all" />
          </Link>
        </section>

        {/* Find us / hours */}
        <FindUs info={companyInfo} />

        {/* Footer */}
        <footer className="text-center pt-4">
          <div className="flex items-center justify-center gap-4 text-stone-800">
            <div className="h-px w-6 bg-stone-800/50" />
            <span className="text-[9px] font-bold uppercase tracking-[0.4em]">Don Fenticas</span>
            <div className="h-px w-6 bg-stone-800/50" />
          </div>
          <p className="text-[9px] text-stone-700 uppercase tracking-widest mt-2">
            &copy; {new Date().getFullYear()} &middot; Licensed Venue &middot; Drink Responsibly
          </p>
        </footer>
      </div>
    </main>
  );
}
