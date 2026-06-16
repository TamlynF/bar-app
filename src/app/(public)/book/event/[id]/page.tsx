import React from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EventBookingForm from "./_components/event-booking-form";
import Image from "next/image";
import {
  Banknote, Calendar, Users, Trophy, Wine,
  MapPin, Clock, DollarSign, Star, CheckCircle,
  Music, Utensils, GlassWater, Heart, Smile,
  Sparkles, AlertCircle, Beer, Info, Speaker, User
} from "lucide-react";
import { cn } from "@/lib/utils";

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

  const config = (event.booking_config as Record<string, unknown>) ?? {};
  const tagline = (config.custom_tagline as string) || (subtype?.tagline as string) || event.tagline || "";
  const eventTitle = event.title || "Event";

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
    <main className="min-h-dvh w-full overflow-x-hidden bg-[#26300D] text-stone-300 flex flex-col selection:bg-[#fdcc4b] selection:text-[#26300D] antialiased">
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

      <div className="flex-1 w-full max-w-3xl mx-auto py-4 sm:py-12 px-4 sm:px-6 lg:px-8 flex flex-col">

        {/* Header */}
        <div className="flex flex-col items-center text-center mb-6 sm:mb-10">
          {config.booking_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={config.booking_image_url as string}
              alt={eventTitle}
              className="w-full max-w-60 h-auto rounded-2xl object-cover"
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
              <span className="text-[10px] font-black uppercase tracking-widest text-[#FDCC4B]">{eventTitle}</span>
            </div>
            <p className="text-stone-300 text-xs sm:text-sm font-bold">
              {eventDate}{timeStr ? ` · ${timeStr}` : ""}
            </p>
            {tagline && (
              <p className="text-stone-400 text-xs sm:text-base font-medium max-w-sm mx-auto leading-relaxed italic opacity-80 text-center">
                {tagline}
              </p>
            )}
          </div>
        </div>

        {/* Event Badges */}
        {eventBadges.length > 0 && (
          <div className="flex flex-row overflow-x-auto no-scrollbar gap-2 pb-4 -mx-4 px-4 mb-4 sm:mb-12 sm:flex-wrap sm:overflow-visible sm:mx-0 sm:px-0 sm:justify-center sm:gap-3">
            {eventBadges.map((badge, index) => (
              <div
                key={index}
                className={cn(
                  "flex items-center justify-center bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 sm:py-3 text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all hover:bg-white/8 hover:border-white/20",
                  "flex-none sm:flex-1 sm:min-w-37.5"
                )}
              >
                <badge.icon className="w-3.5 h-3.5 mr-2 text-[#fdcc4b] shrink-0" />
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
        <div className="pt-8 mt-auto mb-6 flex flex-col items-center gap-4">
          <div className="flex items-center gap-4 text-stone-800">
            <div className="h-px w-6 bg-stone-800/50" />
            <span className="text-[9px] font-bold uppercase tracking-[0.4em]">Don Fenticas</span>
            <div className="h-px w-6 bg-stone-800/50" />
          </div>
          <p className="text-[8px] text-stone-600 uppercase tracking-widest opacity-30">
            Licensed Venue · Please Drink Responsibly
          </p>
        </div>
      </div>
    </main>
  );
}
