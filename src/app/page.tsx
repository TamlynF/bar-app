import Link from "next/link";
import { UtensilsCrossed, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PublicNav } from "@/components/public-nav";
import { HomeHero } from "@/components/home-hero";
import { HighlightedEvents } from "@/components/highlighted-events";
import { GalleryPeek, type GalleryPeekItem } from "@/components/gallery-peek";
import { FindUs, type CompanyInfo } from "@/components/find-us";
import { SpecialsSection, type SpecialRow } from "@/components/specials-section";
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
        "id, title, date, start_time, end_time, is_active, is_fully_booked, is_bookable, external_link, booking_page_url, karaoke_request_url, event_types!inner(name, color), event_subtypes!inner(name, color, is_karaoke)"
      )
      .eq("is_active", true)
      .gte("date", todayStr)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(3),
    supabase
      .from("specials")
      .select("id, title, description, badges, image_url, start_date, end_date, display_order")
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
  const specials = (rawSpecials ?? []) as SpecialRow[];

  const photos = ((rawGallery ?? []) as GalleryRow[]).filter(
    (g) => g.media_type !== "video"
  );
  const backdropUrl = photos[0]?.image_url ?? null;
  const peekItems: GalleryPeekItem[] = photos
    .slice(0, 6)
    .map((g) => ({ id: g.id, title: g.title, image_url: g.image_url }));

  const companyInfo = (info ?? null) as CompanyInfo;
  const description = (info as { description?: string | null } | null)?.description;
  const tagline = description?.trim() || DEFAULT_TAGLINE;

  return (
    <main className="min-h-dvh w-full bg-[#1a2008] text-stone-300 selection:bg-[#FDCC4B] selection:text-[#1a2008] antialiased pb-24">
      <PublicNav currentPath="/" />

      <div className="max-w-3xl mx-auto px-4 pt-4 sm:pt-6 space-y-12 sm:space-y-16">
        {/* Hero */}
        <HomeHero tagline={tagline} backdropUrl={backdropUrl} />

        {/* Highlighted events */}
        <HighlightedEvents events={highlightedEvents} todayStr={todayStr} />

        {/* Specials */}
        {specials.length > 0 && <SpecialsSection specials={specials} />}

        {/* Gallery peek */}
        <GalleryPeek items={peekItems} />

        {/* Menu teaser */}
        <Link
          href="/menu"
          className="group flex items-center gap-4 bg-white/5 hover:bg-white/15 border border-white/20 hover:border-white/30 rounded-2xl p-5 sm:p-6 shadow-lg shadow-black/20 transition-all duration-300 active:scale-[0.99]"
        >
          <div className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center bg-[#FDCC4B]/10 border border-[#FDCC4B]/20">
            <UtensilsCrossed className="w-6 h-6 text-[#FDCC4B]" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="block text-white font-black text-base uppercase tracking-tight">
              See the Menu
            </span>
            <p className="text-stone-400 text-xs leading-relaxed mt-0.5">
              Drinks, cocktails &amp; bar snacks — updated regularly.
            </p>
          </div>
          <ArrowRight className="shrink-0 w-4 h-4 text-stone-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
        </Link>

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
