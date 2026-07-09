import React from "react";
import { createClient } from "@/lib/supabase/server";
import BandBookingForm from "./_components/band-booking-form";
import {
  Banknote, Calendar, Users, Trophy, Wine,
  MapPin, Clock, DollarSign, Star, CheckCircle,
  Music, Utensils, GlassWater, Heart, Smile,
  Sparkles, AlertCircle, Beer, Info, Speaker, User,
} from "lucide-react";
import { PublicNav } from "@/components/public-nav";

export const metadata = {
  title: "Book the Stage | Don Fenticas",
  description: "Apply to perform live at Don Fenticas.",
};

const ICON_MAP: Record<string, React.ElementType> = {
  Banknote, Calendar, Users, Trophy, Wine,
  MapPin, Clock, DollarSign, Star, CheckCircle,
  Music, Utensils, GlassWater, Heart, Smile,
  Sparkles, AlertCircle, Beer, Info, Speaker, User,
};

export default async function BandBookingPage() {
  const supabase = await createClient();

  const { data: infoItems } = await supabase
    .from("event_subtype_badges")
    .select(`icon, title, event_subtypes!inner(behavior)`)
    .eq("event_subtypes.behavior", "music_act");

  const dbBadges = (infoItems || []).map((item) => ({
    icon: ICON_MAP[item.icon || ""] || Info,
    text: item.title,
  }));

  const eventBadges = dbBadges.length > 0 ? dbBadges : [
    { icon: Music, text: "Live Music" },
    { icon: Calendar, text: "Apply Now" },
  ];

  return (
    <main className="flex min-h-dvh w-full flex-col overflow-x-hidden bg-[#26300D] text-stone-300 antialiased selection:bg-[#fdcc4b] selection:text-[#26300D]">
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

      <PublicNav currentPath="/book/band" />

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-12 pt-14 pb-4 pb-12 sm:px-6 lg:px-8">

        {/* Header */}
        {/* <div className="flex flex-col items-center mb-6 text-center sm:mb-10">
          <div className="w-full max-w-45 transition-transform duration-700 hover:scale-[1.02] active:scale-[0.98] sm:max-w-xs">
            <Image
              src="/CompanyName.png"
              alt="Don Fenticas"
              width={300}
              height={90}
              className="object-contain w-full h-auto drop-shadow-[0_10px_20px_rgba(0,0,0,0.3)]"
              priority
            />
          </div>
          <div className="mt-5 px-2 space-y-2 sm:mt-7">
            <div className="inline-flex items-center gap-2 mb-1 px-4 py-1.5 bg-[#FDCC4B]/10 border-[#FDCC4B]/20 rounded-full border">
              <span className="font-black text-[#FDCC4B] text-[10px] tracking-widest uppercase">Book the Stage</span>
            </div>
            <p className="mx-auto max-w-sm font-medium text-stone-400 text-xs text-center leading-relaxed opacity-80 italic sm:text-base">
              Apply to perform live at Don Fenticas. We&apos;d love to hear you play.
            </p>
          </div>
        </div> */}

        {/* Event Badges */}
        {/* <div className="overflow-x-auto flex flex-row flex-wrap justify-center gap-2 gap-3 mx-0 mb-12 mb-4 px-0 px-4 pb-4 -mx-4 no-scrollbar sm:overflow-visible">
          {eventBadges.map((badge, index) => (
            <div
              key={index}
              className={cn(
                "flex justify-center items-center bg-white/5 hover:bg-white/8 px-4 py-2.5 sm:py-3 border border-white/10 hover:border-white/20 rounded-xl font-black text-[10px] sm:text-[11px] uppercase tracking-wider transition-all",
                "flex-none sm:flex-1 sm:min-w-37.5"
              )}
            >
              <badge.icon className="mr-2 w-3.5 h-3.5 text-[#fdcc4b] shrink-0" />
              <span className="text-stone-200 whitespace-nowrap">{badge.text}</span>
            </div>
          ))}
        </div> */}

        {/* Booking Form Card */}
        <div className="relative mb-12 overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/3 p-6 shadow-2xl ring-1 ring-white/5 backdrop-blur-xl sm:p-10">
          <div className="pointer-events-none absolute -top-32 -left-32 h-64 w-64 rounded-full bg-[#fdcc4b]/10 blur-[100px]" />

          <div className="relative z-10 mb-8 text-center">
            <h3 className="font-black text-2xl leading-none tracking-tighter text-white uppercase sm:text-4xl">Book the Stage</h3>
            <p className="mt-2 text-xs font-medium text-stone-500 sm:text-base">Fill in your details and we&apos;ll review your application.</p>
          </div>

          <div className="relative z-10">
            <BandBookingForm />
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
            Licensed Venue • Please Drink Responsibly
          </p>
        </div>

      </div>
    </main>
  );
}
