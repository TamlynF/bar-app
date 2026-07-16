import React from "react";
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
        <div className="mb-4 flex flex-col items-center text-center sm:mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bannerImage}
            alt={eventTitle}
            className="mx-auto -mt-2 h-auto w-full object-contain sm:max-w-md"
          />
          <div className="mt-4 space-y-2 px-2 sm:mt-5">
            <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-[#FDCC4B]/20 bg-[#FDCC4B]/10 px-4 py-1.5">
              <span className="font-black text-[10px] tracking-widest text-[#FDCC4B] uppercase">{eventTitle}</span>
            </div>
            <p className="text-xs font-bold text-(--ev-fg,#d6d3d1) sm:text-sm">
              {eventDate}{timeStr ? ` · ${timeStr}` : ""}
            </p>
            {tagline && (
              <p className="mx-auto max-w-sm text-center text-xs leading-relaxed font-medium text-(--ev-fg-dim,#a8a29e) italic sm:max-w-2xl sm:text-base">
                {tagline}
              </p>
            )}
          </div>
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
