import React from "react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EventBookingForm from "./_components/event-booking-form";
import ImageThemer from "./_components/image-themer";
import {
  Banknote, Calendar, Users, Trophy, Wine,
  MapPin, Clock, DollarSign, Star, CheckCircle,
  Music, Utensils, GlassWater, Heart, Smile,
  Sparkles, AlertCircle, Beer, Info, Speaker, User
} from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeBookingConfig, type BookingConfig } from "@/lib/booking-config";
import { PublicNav } from "@/components/public-nav";

const ICON_MAP: Record<string, React.ElementType> = {
  Banknote, Calendar, Users, Trophy, Wine,
  MapPin, Clock, DollarSign, Star, CheckCircle,
  Music, Utensils, GlassWater, Heart, Smile,
  Sparkles, AlertCircle, Beer, Info, Speaker, User
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("title")
    .eq("id", id)
    .maybeSingle();

  return {
    title: event?.title ? `${event.title} | Don Fenticas` : "Book Event | Don Fenticas",
    description: "Book your spot at Don Fenticas.",
  };
}

export default async function EventBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: event } = await supabase
    .from("events")
    .select("id, date, start_time, end_time, title, tagline, payment_amount, seating_required, is_fully_booked, is_bookable, booking_config, event_subtypes_id")
    .eq("id", id)
    .eq("is_active", true)
    .eq("is_bookable", true)
    .gte("date", today)
    .maybeSingle();

  if (!event) notFound();

  // Fetch subtype info + badges
  const [{ data: subtype }, { data: infoItems }] = await Promise.all([
    supabase
      .from("event_subtypes")
      .select("name, tagline, color")
      .eq("id", event.event_subtypes_id)
      .maybeSingle(),
    supabase
      .from("event_subtype_badges")
      .select("icon, title")
      .eq("event_subtypes_id", event.event_subtypes_id),
  ]);

  const config = (event.booking_config as BookingConfig) ?? {};
  const cfg = normalizeBookingConfig(config);
  const tagline = cfg.tag_line || (subtype?.tagline as string) || event.tagline || "";
  const eventTitle = event.title || "Event";
  // Banner + theme source: the event's booking image, falling back to the logo so
  // the header always renders a themed banner (matches the grouped booking page).
  const bannerImage = cfg.booking_image_url || "/CompanyName.png";

  const dbBadges = (infoItems || []).map((item) => ({
    icon: ICON_MAP[item.icon || ""] || Info,
    text: item.title,
  }));

  const eventBadges = dbBadges.length > 0 ? dbBadges : [];

  const formatTime = (t: string | null) => t ? t.substring(0, 5) : null;
  const startTime = formatTime(event.start_time);
  const endTime = formatTime(event.end_time);
  const timeStr = startTime && endTime ? `${startTime} - ${endTime}` : startTime || null;

  const eventDate = new Date(event.date + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <main className="relative flex min-h-dvh w-full flex-col overflow-x-hidden bg-[#26300D] text-stone-300 antialiased selection:bg-[#fdcc4b] selection:text-[#26300D]">
      <style dangerouslySetInnerHTML={{ __html: `
        html, body {
          background-color: #26300D !important;
          margin: 0; padding: 0;
          width: 100%; height: 100%;
          overflow-x: hidden;
        }
        main {
          padding-top: env(safe-area-inset-top, 10px);
          padding-bottom: env(safe-area-inset-bottom, 20px);
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />

      {/* Dynamic theme — the banner image's dominant colour is sampled client-side
          into the `--ev-theme` CSS variable and bled across the page via gradients.
          The banner is the event's booking image, or the company logo when absent,
          so the header always themes. Mirrors the grouped booking page. */}
      <ImageThemer imageUrl={bannerImage} />

      {/* Colour wash — a strong field of the image's colour that carries down over
          most of the page (past 75%) before resolving into the olive base. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(to_bottom,var(--ev-theme,transparent)_0%,var(--ev-theme,transparent)_35%,transparent_82%)] opacity-80"
      />

      <PublicNav currentPath="/book/event" />

      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-12 pb-4 sm:px-6 sm:pt-14 sm:pb-6 lg:px-8">

        {/* Header */}
        <div className="flex flex-col items-center text-center mb-6 sm:mb-10">
          {cfg.booking_image_url ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cfg.booking_image_url}
                alt={eventTitle}
                className="w-full h-auto object-contain -mt-2 mask-[linear-gradient(to_bottom,black_90%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,black_90%,transparent_100%)]"
              />
              <div className="mt-5 sm:mt-7 space-y-2 px-2">
                <div className="inline-flex items-center gap-2 bg-[#FDCC4B]/10 border border-[#FDCC4B]/20 rounded-full px-4 py-1.5 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#FDCC4B]">{eventTitle}</span>
                </div>
                <p className="text-stone-300 text-xs sm:text-sm font-bold">
                  {eventDate}{timeStr ? ` · ${timeStr}` : ""}
                </p>
                {tagline && <p className="text-stone-500 text-xs sm:text-sm italic">{tagline}</p>}
              </div>
            </>
          ) : (
            <div className="relative w-full px-2 pt-6 sm:pt-10">
              {/* Soft gold glow behind the title */}
              <div
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 w-[420px] h-[240px] rounded-full bg-[#FDCC4B]/10 blur-[80px]"
              />

              {/* Brand lockup — small; the logo already lives in the nav */}
              <div className="relative inline-flex items-center gap-3 mb-4 sm:mb-5">
                <span aria-hidden className="h-px w-7 bg-[#FDCC4B]/30" />
                <Image src="/Logo.png" alt="" width={26} height={26} className="rounded-lg" />
                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#FDCC4B]">
                  Don Fenticas presents
                </span>
                <span aria-hidden className="h-px w-7 bg-[#FDCC4B]/30" />
              </div>

              {/* The event is the hero */}
              <h1 className="relative text-[#FFF4CC] font-black uppercase tracking-tighter leading-[0.95] text-4xl sm:text-6xl drop-shadow-[0_8px_40px_rgba(253,204,75,0.15)]">
                {eventTitle}
              </h1>

              {/* Date / time chips — match the public form-input surface */}
              <div className="relative mt-5 flex flex-wrap items-center justify-center gap-2.5">
                <span className="inline-flex items-center gap-2 bg-black/40 border border-white/10 rounded-full px-4 py-2 text-xs font-bold text-[#FFF4CC]">
                  <Calendar className="w-3.5 h-3.5 text-[#FDCC4B]" aria-hidden />
                  {eventDate}
                </span>
                {timeStr && (
                  <span className="inline-flex items-center gap-2 bg-black/40 border border-white/10 rounded-full px-4 py-2 text-xs font-bold text-[#FFF4CC]">
                    <Clock className="w-3.5 h-3.5 text-[#FDCC4B]" aria-hidden />
                    {timeStr}
                  </span>
                )}
              </div>

              {tagline && (
                <p className="relative mt-4 text-xs sm:text-sm italic text-stone-500">{tagline}</p>
              )}
            </div>
          )}
        </div>

        {/* Event Badges */}
        {eventBadges.length > 0 && (
          <div className="no-scrollbar -mx-4 mb-4 flex flex-row gap-2 overflow-x-auto px-4 pb-4 sm:mx-0 sm:mb-5 sm:flex-wrap sm:justify-center sm:gap-3 sm:overflow-visible sm:px-0">
            {eventBadges.map((badge, index) => (
              <div
                key={index}
                className={cn(
                  "flex items-center justify-center rounded-xl border border-white/25 bg-black/30 px-4 py-2.5 font-black text-[10px] tracking-wider uppercase shadow-lg shadow-black/20 backdrop-blur-sm transition-all hover:border-white/40 hover:bg-black/40 sm:py-3 sm:text-[11px]",
                  "flex-none sm:min-w-37.5 sm:flex-1"
                )}
              >
                <badge.icon className="mr-2 h-3.5 w-3.5 shrink-0 text-[#fdcc4b]" />
                <span className="whitespace-nowrap text-stone-200">{badge.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Booking Form Card */}
        <div className="relative mb-12 overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/3 p-6 shadow-2xl ring-1 ring-white/5 backdrop-blur-xl sm:p-10">
          <div className="pointer-events-none absolute -top-32 -left-32 h-64 w-64 rounded-full bg-[#fdcc4b]/10 blur-[100px]" />
          {/* Image-colour glow, complements the gold one and ties the card to the theme */}
          {cfg.booking_image_url && (
            <div className="pointer-events-none absolute -right-28 -bottom-28 h-64 w-64 rounded-full bg-(--ev-theme) opacity-12 blur-[100px]" />
          )}

          <div className="relative z-10 mb-8 text-center">
            <h3 className="font-black text-2xl leading-none tracking-tighter text-white uppercase sm:text-4xl">Book Your Spot</h3>
            <p className="mt-2 text-xs font-medium text-(--ev-fg-dim,#78716c) sm:text-base">
              Fill in the details below to reserve your place.
            </p>
          </div>

          <div className="relative z-10">
            <EventBookingForm
              event={{
                id: event.id as number,
                date: event.date as string,
                title: eventTitle,
                payment_amount: event.payment_amount as number | null,
                is_fully_booked: (event.is_fully_booked as boolean) ?? false,
                seating_required: (event.seating_required as boolean) ?? false,
              }}
              config={config}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto mb-6 flex flex-col items-center gap-4 pt-8">
          <div className="flex items-center gap-4 text-stone-800">
            <div className="h-px w-6 bg-stone-800/50" />
            <span className="text-[9px] font-bold tracking-[0.4em] uppercase">Don Fenticas</span>
            <div className="h-px w-6 bg-stone-800/50" />
          </div>
          <p className="text-[8px] tracking-widest text-stone-600 uppercase opacity-30">
            Licensed Venue · Please Drink Responsibly
          </p>
        </div>
      </div>
    </main>
  );
}
