import React from "react";
import type { Viewport } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EventBookingForm from "./_components/event-booking-form";
import {
  Banknote, Calendar, Users, Trophy, Wine,
  MapPin, Clock, DollarSign, Star, CheckCircle,
  Music, Utensils, GlassWater, Heart, Smile,
  Sparkles, AlertCircle, Beer, Info, Speaker, User, Ghost
} from "lucide-react";
import { normalizeBookingConfig, type BookingConfig } from "@/lib/booking-config";
import { PublicNav } from "@/components/public-nav";
import { MarqueeTicker } from "@/components/marquee-ticker";
import { ExtrudedTitle } from "@/components/extruded-title";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Banknote, Calendar, Users, Trophy, Wine,
  MapPin, Clock, DollarSign, Star, CheckCircle,
  Music, Utensils, GlassWater, Heart, Smile,
  Sparkles, AlertCircle, Beer, Info, Speaker, User, Ghost
};

export const viewport: Viewport = {
  themeColor: "#26300D",
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

  const dbBadges = (infoItems || []).map((item) => ({
    Icon: ICON_MAP[item.icon || ""] || Info,
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
    <main className="relative flex flex-col bg-[#26300D] selection:bg-[#fdcc4b] w-full min-h-dvh overflow-x-hidden text-stone-300 selection:text-[#26300D] antialiased">
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


      <div
        aria-hidden
        className="z-0 absolute inset-0 bg-[linear-gradient(to_bottom,var(--ev-theme,transparent)_0%,var(--ev-theme,transparent)_35%,transparent_82%)] opacity-80 pointer-events-none"
      />

      <PublicNav currentPath="/book/event" />

      <div className="z-10 relative flex flex-col flex-1 mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-6 w-full max-w-3xl">

        <div className="flex flex-col items-center mb-6 sm:mb-10 text-center">
          {cfg.booking_image_url ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cfg.booking_image_url}
                alt={eventTitle}
                className="-mt-2 w-full h-auto object-contain mask-[linear-gradient(to_bottom,black_90%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,black_90%,transparent_100%)]"
              />
              <div className="space-y-2 mt-5 sm:mt-7 px-2">
                <div className="inline-flex items-center gap-2 bg-[#FDCC4B]/10 mb-1 px-4 py-1.5 border border-[#FDCC4B]/20 rounded-full">
                  <span className="font-black text-[#FDCC4B] text-[10px] uppercase tracking-widest">{eventTitle}</span>
                </div>
                <p className="font-bold text-stone-300 text-xs sm:text-sm">
                  {eventDate}{timeStr ? ` · ${timeStr}` : ""}
                </p>
                {tagline && <p className="text-stone-500 text-xs sm:text-sm italic">{tagline}</p>}
              </div>
            </>
          ) : (
            <div className="relative px-2 py-2 w-full">
              {/*
                No poster uploaded, so the act's name IS the backdrop —
                extruded and slowly turning, like a stage screen. The
                component brings its own stage-light glow, so the old
                blur blob and the "Don Fenticas presents" eyebrow go:
                the brand is already in the nav (STYLE_GUIDE identity rule)
                and the eyebrow was competing with the title for height.
                Poster events keep the image branch above untouched.
              */}
              <ExtrudedTitle text={eventTitle} className="py-4 sm:py-8" />

              <div className="relative flex flex-wrap justify-center items-center gap-2.5 mt-3">
                <span className="inline-flex items-center gap-2 bg-black/40 px-4 py-2 border border-white/10 rounded-full font-bold text-[#FFF4CC] text-xs">
                  <Calendar className="w-3.5 h-3.5 text-[#FDCC4B]" aria-hidden />
                  {eventDate}{timeStr ? ` · ${timeStr}` : ""}
                </span>
              </div>

              {tagline && (
                <p className="relative mx-auto mt-3 w-full max-w-none font-medium text-[#FDCC4B]/90 text-base sm:text-xl italic">{tagline}</p>
              )}
            </div>
          )}
        </div>

        {eventBadges.length > 0 && (
          <div className="left-1/2 relative mb-8 sm:mb-10 w-screen -translate-x-1/2">
            <MarqueeTicker items={eventBadges} straight />
          </div>
        )}

        <div className="relative bg-white/3 shadow-2xl backdrop-blur-xl mb-12 p-6 sm:p-10 border border-white/10 rounded-[2.5rem] ring-1 ring-white/5 overflow-hidden">
          <div className="-top-32 -left-32 absolute bg-[#fdcc4b]/10 blur-[100px] rounded-full w-64 h-64 pointer-events-none" />
          {cfg.booking_image_url && (
            <div className="absolute h-64 w-64 bg-(--ev-theme) rounded-full opacity-12 blur-[100px] pointer-events-none -right-28 -bottom-28" />
          )}

          <div className="z-10 relative mb-8 text-center">
            <h3 className="font-black text-white text-2xl sm:text-4xl uppercase leading-none tracking-tighter">Book Your Spot</h3>
            <p className="mt-2 text-xs font-medium text-(--ev-fg-dim,#78716c) sm:text-base">
              Fill in the details below to reserve your place.
            </p>
          </div>

          <div className="z-10 relative">
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

        <div className="flex flex-col items-center gap-4 mt-auto mb-6 pt-8">
          <div className="flex items-center gap-4 text-stone-800">
            <div className="bg-stone-800/50 w-6 h-px" />
            <span className="font-bold text-[9px] uppercase tracking-[0.4em]">Don Fenticas</span>
            <div className="bg-stone-800/50 w-6 h-px" />
          </div>
          <p className="opacity-30 text-[8px] text-stone-600 uppercase tracking-widest">
            Licensed Venue · Please Drink Responsibly
          </p>
        </div>
      </div>
    </main>
  );
}
