import React from "react";
import { createClient } from "@/lib/supabase/server";
import PrivateHireForm from "./_components/private-hire-form";
import Image from "next/image";
import {
  Banknote, Calendar, Users, Trophy, Wine,
  MapPin, Clock, DollarSign, Star, CheckCircle,
  Music, Utensils, GlassWater, Heart, Smile,
  Sparkles, AlertCircle, Beer, Info, Speaker, User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PublicNav } from "@/components/public-nav";

export const metadata = {
  title: "Private Hire | Don Fenticas",
  description: "Book Don Fenticas for your private event.",
};

const ICON_MAP: Record<string, React.ElementType> = {
  Banknote, Calendar, Users, Trophy, Wine,
  MapPin, Clock, DollarSign, Star, CheckCircle,
  Music, Utensils, GlassWater, Heart, Smile,
  Sparkles, AlertCircle, Beer, Info, Speaker, User,
};

export default async function PrivateHirePage() {
  const supabase = await createClient();

  const { data: infoItems } = await supabase
    .from("event_subtype_badges")
    .select(`icon, title, event_subtypes!inner(behavior)`)
    .eq("event_subtypes.behavior", "private");

  // Private event subtypes the enquiry can be for (behavior 'private' under the
  // 'private' event type). Offered in the form, labelled by default_event_title.
  const { data: subtypeRows } = await supabase
    .from("event_subtypes")
    .select("id, name, default_event_title, event_types!inner(name)")
    .eq("behavior", "private")
    .eq("event_types.name", "private")
    .order("name");

  const subtypes = (subtypeRows ?? []).map((s) => ({
    id: s.id as number,
    name: s.name as string,
    default_event_title: (s.default_event_title as string | null) ?? null,
  }));

  const dbBadges = (infoItems || []).map((item) => ({
    icon: ICON_MAP[item.icon || ""] || Info,
    text: item.title,
  }));

  const eventBadges = dbBadges.length > 0 ? dbBadges : [
    { icon: Users, text: "Up to 200 Guests" },
    { icon: Banknote, text: "Deposit Required" },
    { icon: Utensils, text: "Catering Available" },
    { icon: Star, text: "Exclusive Hire" },
    { icon: Calendar, text: "Enquire Now" },
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

      <PublicNav currentPath="/book/private" />

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-12 pb-4 sm:px-6 sm:pt-14 sm:pb-12 lg:px-8">

        {/* Header */}
        <div className="mb-6 flex flex-col items-center text-center sm:mb-10">
          <div className="w-full max-w-45 transition-transform duration-700 hover:scale-[1.02] active:scale-[0.98] sm:max-w-xs">
            <Image
              src="/CompanyName.png"
              alt="Don Fenticas"
              width={300}
              height={90}
              className="h-auto w-full object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.3)]"
              priority
            />
          </div>
          <div className="mt-5 space-y-2 px-2 sm:mt-7">
            <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-[#FDCC4B]/20 bg-[#FDCC4B]/10 px-4 py-1.5">
              <span className="font-black text-[10px] tracking-widest text-[#FDCC4B] uppercase">Private Hire</span>
            </div>
            <p className="mx-auto max-w-sm text-center text-xs leading-relaxed font-medium text-stone-400 italic opacity-80 sm:text-base">
              Celebrate your special occasion at Don Fenticas. Exclusive hire for birthdays, corporates, and more.
            </p>
          </div>
        </div>

        {/* Event Badges */}
        <div className="no-scrollbar -mx-4 mb-4 flex flex-row gap-2 overflow-x-auto px-4 pb-4 sm:mx-0 sm:mb-12 sm:flex-wrap sm:justify-center sm:gap-3 sm:overflow-visible sm:px-0">
          {eventBadges.map((badge, index) => (
            <div
              key={index}
              className={cn(
                "flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 font-black text-[10px] tracking-wider uppercase transition-all hover:border-white/20 hover:bg-white/8 sm:py-3 sm:text-[11px]",
                "flex-none sm:min-w-37.5 sm:flex-1"
              )}
            >
              <badge.icon className="mr-2 h-3.5 w-3.5 shrink-0 text-[#fdcc4b]" />
              <span className="whitespace-nowrap text-stone-200">{badge.text}</span>
            </div>
          ))}
        </div>

        {/* Enquiry Form Card */}
        <div className="relative mb-12 rounded-[2.5rem] border border-white/10 bg-white/3 p-6 shadow-2xl ring-1 ring-white/5 backdrop-blur-xl sm:p-10">
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2.5rem]">
            <div className="absolute -top-32 -left-32 h-64 w-64 rounded-full bg-[#fdcc4b]/10 blur-[100px]" />
          </div>

          <div className="relative z-10 mb-8 text-center">
            <h3 className="font-black text-2xl leading-none tracking-tighter text-white uppercase sm:text-4xl">Private Hire</h3>
            <p className="mt-2 text-xs font-medium text-stone-500 sm:text-base">Fill in your details and we&apos;ll confirm availability.</p>
          </div>

          <div className="relative z-10">
            <PrivateHireForm subtypes={subtypes} />
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
