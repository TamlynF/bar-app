import React from "react";
import { createClient } from "@/lib/supabase/server";
import BingoBookingForm, { type BingoEvent } from "./_components/bingo-booking-form";
import Image from "next/image";
import {
  Banknote, Calendar, Users, Trophy, Wine,
  MapPin, Clock, DollarSign, Star, CheckCircle,
  Music, Utensils, GlassWater, Heart, Smile,
  Sparkles, AlertCircle, Beer, Info, Speaker, User
} from "lucide-react";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Music Bingo | Don Fenticas",
  description: "Book your spot for Music Bingo night at Don Fenticas.",
};

const ICON_MAP: Record<string, React.ElementType> = {
  Banknote, Calendar, Users, Trophy, Wine,
  MapPin, Clock, DollarSign, Star, CheckCircle,
  Music, Utensils, GlassWater, Heart, Smile,
  Sparkles, AlertCircle, Beer, Info, Speaker, User
};

export default async function BingoBookingPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  const [{ data: rawEvents }, { data: infoItems }] = await Promise.all([
    supabase
      .from("events")
      .select("id, date, payment_amount, event_types!inner(type, sub_type, description)")
      .eq("event_types.type", "games")
      .eq("event_types.sub_type", "bingo")
      .eq("is_active", true)
      .gte("date", today)
      .order("date", { ascending: true }),
    supabase
      .from("event_information")
      .select(`icon, title, event_types!inner(type, sub_type, description)`)
      .eq("event_types.type", "games")
      .eq("event_types.sub_type", "bingo"),
  ]);

  const events: BingoEvent[] = (rawEvents ?? []).map((e) => ({
    id: e.id as number,
    date: e.date as string,
    payment_amount: e.payment_amount as number | null,
  }));

  const dbBadges = (infoItems || []).map((item) => ({
    icon: ICON_MAP[item.icon || ""] || Info,
    text: item.title,
  }));

  const eventBadges = dbBadges.length > 0 ? dbBadges : [
    { icon: Music, text: "Music Bingo" },
    { icon: Banknote, text: "Pay on the Night" },
    { icon: Users, text: "Groups Welcome" },
    { icon: Trophy, text: "Prizes to Win" },
    { icon: Beer, text: "Great Drinks" },
  ];

  return (
    <main className="min-h-dvh w-full overflow-x-hidden bg-[#26300D] text-stone-300 flex flex-col selection:bg-[#fdcc4b] selection:text-[#26300D] antialiased">
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

      <div className="flex-1 w-full max-w-3xl mx-auto py-4 sm:py-12 px-4 sm:px-6 lg:px-8 flex flex-col">

        {/* Header */}
        <div className="flex flex-col items-center text-center mb-6 sm:mb-10">
          <div className="w-full max-w-[180px] sm:max-w-xs transition-transform duration-700 hover:scale-[1.02] active:scale-[0.98]">
            <Image
              src="/CompanyName.png"
              alt="Don Fenticas"
              width={300}
              height={90}
              className="w-full h-auto object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.3)]"
              priority
            />
          </div>
          <div className="mt-5 sm:mt-7 space-y-2 px-2">
            <div className="inline-flex items-center gap-2 bg-[#FDCC4B]/10 border border-[#FDCC4B]/20 rounded-full px-4 py-1.5 mb-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#FDCC4B]">Music Bingo</span>
            </div>
            <p className="text-stone-400 text-xs sm:text-base font-medium max-w-sm mx-auto leading-relaxed italic opacity-80 text-center">
              Bingo with a beat. Guess the song, fill your card, win the night.
            </p>
          </div>
        </div>

        {/* Event Badges */}
        <div className="flex flex-row overflow-x-auto no-scrollbar gap-2 pb-4 -mx-4 px-4 mb-4 sm:mb-12 sm:flex-wrap sm:overflow-visible sm:mx-0 sm:px-0 sm:justify-center sm:gap-3">
          {eventBadges.map((badge, index) => (
            <div
              key={index}
              className={cn(
                "flex items-center justify-center bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 sm:py-3 text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all hover:bg-white/8 hover:border-white/20",
                "flex-none sm:flex-1 sm:min-w-[150px]"
              )}
            >
              <badge.icon className="w-3.5 h-3.5 mr-2 text-[#fdcc4b] shrink-0" />
              <span className="text-stone-200 whitespace-nowrap">{badge.text}</span>
            </div>
          ))}
        </div>

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
              <BingoBookingForm events={events} />
            ) : (
              <div className="text-center py-8">
                <p className="text-stone-300 font-black text-lg uppercase tracking-tight mb-2">No Upcoming Events</p>
                <p className="text-stone-500 text-sm font-medium">There are no bingo nights scheduled yet. Please check back soon!</p>
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
