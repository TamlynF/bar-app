import React from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import GroupedBookingForm, { type GroupedEvent } from "./_components/grouped-booking-form";
import ImageThemer from "../../../event/[id]/_components/image-themer";
import Image from "next/image";
import {
  Banknote, Calendar, Users, Trophy, Wine,
  MapPin, Clock, DollarSign, Star, CheckCircle,
  Music, Utensils, GlassWater, Heart, Smile,
  Sparkles, AlertCircle, Beer, Info, Speaker, User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeBookingConfig, type BookingConfig } from "@/lib/booking-config";

const ICON_MAP: Record<string, React.ElementType> = {
  Banknote, Calendar, Users, Trophy, Wine,
  MapPin, Clock, DollarSign, Star, CheckCircle,
  Music, Utensils, GlassWater, Heart, Smile,
  Sparkles, AlertCircle, Beer, Info, Speaker, User,
};

type Scope = "type" | "subtype";

function isScope(v: string): v is Scope {
  return v === "type" || v === "subtype";
}

async function loadHeader(scope: Scope, id: string) {
  const supabase = await createClient();
  if (scope === "subtype") {
    const [{ data: subtype }, { data: badges }] = await Promise.all([
      supabase.from("event_subtypes").select("name, tagline, booking_config").eq("id", id).maybeSingle(),
      supabase.from("event_subtype_badges").select("icon, title").eq("event_subtypes_id", id),
    ]);
    return {
      title: (subtype?.name as string | null) || "Events",
      tagline: (subtype?.tagline as string | null) || "",
      badges: badges ?? [],
      bookingConfig: (subtype?.booking_config as BookingConfig | null) ?? {},
    };
  }
  const { data: type } = await supabase.from("event_types").select("name, booking_config").eq("id", id).maybeSingle();
  return {
    title: (type?.name as string | null) || "Events",
    tagline: "",
    badges: [] as { icon: string | null; title: string }[],
    bookingConfig: (type?.booking_config as BookingConfig | null) ?? {},
  };
}

export async function generateMetadata({ params }: { params: Promise<{ scope: string; id: string }> }) {
  const { scope, id } = await params;
  if (!isScope(scope)) return { title: "Book | Don Fenticas" };
  const header = await loadHeader(scope, id);
  return {
    title: `${header.title} | Don Fenticas`,
    description: `Book your spot at Don Fenticas.`,
  };
}

const toTitleCase = (s: string) =>
  s.trim().split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");

export default async function GroupedBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ scope: string; id: string }>;
  searchParams: Promise<{ id?: string }>;
}) {
  const { scope, id } = await params;
  const { id: defaultEventId } = await searchParams;
  if (!isScope(scope)) notFound();

  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  let query = supabase
    .from("events")
    .select("id, date, start_time, title, tagline, payment_amount, is_fully_booked, seating_required")
    .eq("is_active", true)
    .eq("is_bookable", true)
    .gte("date", today)
    .order("date", { ascending: true });

  query = scope === "subtype"
    ? query.eq("event_subtypes_id", id)
    : query.eq("event_types_id", id);

  const [{ data: rawEvents }, header] = await Promise.all([query, loadHeader(scope, id)]);

  const events: GroupedEvent[] = (rawEvents ?? []).map((e) => ({
    id: e.id as number,
    date: e.date as string,
    start_time: (e.start_time as string | null) ?? null,
    title: (e.title as string | null) ?? null,
    payment_amount: e.payment_amount as number | null,
    is_fully_booked: (e.is_fully_booked as boolean) ?? false,
    seating_required: (e.seating_required as boolean) ?? false,
  }));

  // The whole group shares one booking form/page config (from the type or sub-type).
  const cfg = normalizeBookingConfig(header.bookingConfig);
  const tagline = cfg.tag_line || header.tagline;
  const title = toTitleCase(header.title);
  const badges = (header.badges || []).map((item) => ({
    Icon: ICON_MAP[item.icon || ""] || Info,
    text: item.title,
  }));

  return (
    <main className="relative min-h-dvh w-full overflow-x-hidden bg-[#26300D] text-stone-300 flex flex-col selection:bg-[#fdcc4b] selection:text-[#26300D] antialiased">
      <style dangerouslySetInnerHTML={{ __html: `
        html, body {
          background-color: #26300D !important;
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          overflow-x: hidden;
        }
        main {
          padding-top: env(safe-area-inset-top, 10px);
          padding-bottom: env(safe-area-inset-bottom, 20px);
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />

      {/* Dynamic theme — the shared booking image's dominant colour is sampled
          client-side and bled across the page. Falls back to olive when absent. */}
      {cfg.booking_image_url && (
        <>
          <ImageThemer imageUrl={cfg.booking_image_url} />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[85vh] z-0 opacity-70 bg-[linear-gradient(to_bottom,var(--ev-theme,transparent)_0%,var(--ev-theme,transparent)_20%,transparent_58%)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[60vh] z-0 overflow-hidden mask-[linear-gradient(to_bottom,black_0%,transparent_85%)] [-webkit-mask-image:linear-gradient(to_bottom,black_0%,transparent_85%)]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cfg.booking_image_url}
              alt=""
              className="w-full h-full object-cover scale-150 blur-3xl opacity-45"
            />
          </div>
        </>
      )}

      <div className="relative z-10 flex-1 w-full max-w-3xl mx-auto py-4 sm:py-12 px-4 sm:px-6 lg:px-8 flex flex-col">

        {/* Header */}
        <div className="flex flex-col items-center text-center mb-6 sm:mb-10">
          {cfg.booking_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cfg.booking_image_url}
              alt={title}
              className="w-full h-auto object-contain -mt-2 mask-[linear-gradient(to_bottom,black_90%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,black_90%,transparent_100%)]"
            />
          ) : (
            <div className="w-full max-w-45 sm:max-w-xs">
              <Image
                src="/CompanyName.png"
                alt="Don Fenticas"
                width={300}
                height={90}
                className="w-full h-auto object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.3)]"
                priority
              />
            </div>
          )}
          <div className="mt-5 sm:mt-7 space-y-2 px-2">
            <div className="inline-flex items-center gap-2 bg-[#FDCC4B]/10 border border-[#FDCC4B]/20 rounded-full px-4 py-1.5 mb-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#FDCC4B]">{title}</span>
            </div>
            {tagline && (
              <p className="text-stone-400 text-xs sm:text-base font-medium max-w-sm mx-auto leading-relaxed italic opacity-80 text-center">
                {tagline}
              </p>
            )}
          </div>
        </div>

        {/* Event Badges */}
        {badges.length > 0 && (
          <div className="flex flex-row overflow-x-auto no-scrollbar gap-2 pb-4 -mx-4 px-4 mb-4 sm:mb-12 sm:flex-wrap sm:overflow-visible sm:mx-0 sm:px-0 sm:justify-center sm:gap-3">
            {badges.map((badge, index) => (
              <div
                key={index}
                className={cn(
                  "flex items-center justify-center bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 sm:py-3 text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all hover:bg-white/8 hover:border-white/20",
                  "flex-none sm:flex-1 sm:min-w-37.5"
                )}
              >
                <badge.Icon className="w-3.5 h-3.5 mr-2 text-[#fdcc4b] shrink-0" />
                <span className="text-stone-200 whitespace-nowrap">{badge.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Booking Form Card */}
        <div className="bg-white/3 backdrop-blur-xl rounded-[2.5rem] p-6 sm:p-10 border border-white/10 shadow-2xl relative overflow-hidden ring-1 ring-white/5 mb-12">
          <div className="absolute -top-32 -left-32 w-64 h-64 bg-[#fdcc4b]/10 blur-[100px] rounded-full pointer-events-none" />

          <div className="mb-8 text-center relative z-10">
            <h3 className="text-2xl sm:text-4xl font-black text-white tracking-tighter uppercase leading-none">Book Your Spot</h3>
            <p className="text-stone-500 text-xs sm:text-base mt-2 font-medium">
              {events.length > 0
                ? "Select a date below and lock in your place."
                : "Check back soon for upcoming events."}
            </p>
          </div>

          <div className="relative z-10">
            {events.length > 0 ? (
              <GroupedBookingForm events={events} config={header.bookingConfig} showTitleInSelector={scope === "type"} defaultEventId={defaultEventId} />
            ) : (
              <div className="text-center py-8">
                <p className="text-stone-300 font-black text-lg uppercase tracking-tight mb-2">No Upcoming Events</p>
                <p className="text-stone-500 text-sm font-medium">There are no events scheduled yet. Please check back soon!</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-8 mt-auto mb-6 flex flex-col items-center gap-4">
          <div className="flex items-center gap-4 text-stone-800">
            <div className="h-px w-6 bg-stone-800/50" />
            <span className="text-[9px] font-bold uppercase tracking-[0.4em]">Don Fenticas</span>
            <div className="h-px w-6 bg-stone-800/50" />
          </div>
          <p className="text-[8px] text-stone-600 uppercase tracking-widest opacity-30">
            Licensed Venue • Please Drink Responsibly
          </p>
        </div>

      </div>
    </main>
  );
}
