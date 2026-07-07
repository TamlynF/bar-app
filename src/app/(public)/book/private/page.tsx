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

      <PublicNav currentPath="/book/private" />

      <div className="flex-1 w-full max-w-3xl mx-auto pt-12 pb-4 sm:pt-14 sm:pb-12 px-4 sm:px-6 lg:px-8 flex flex-col">

        {/* Header */}
        <div className="flex flex-col items-center text-center mb-6 sm:mb-10">
          <div className="w-full max-w-45 sm:max-w-xs transition-transform duration-700 hover:scale-[1.02] active:scale-[0.98]">
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
              <span className="text-[10px] font-black uppercase tracking-widest text-[#FDCC4B]">Private Hire</span>
            </div>
            <p className="text-stone-400 text-xs sm:text-base font-medium max-w-sm mx-auto leading-relaxed italic opacity-80 text-center">
              Celebrate your special occasion at Don Fenticas. Exclusive hire for birthdays, corporates, and more.
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
                "flex-none sm:flex-1 sm:min-w-37.5"
              )}
            >
              <badge.icon className="w-3.5 h-3.5 mr-2 text-[#fdcc4b] shrink-0" />
              <span className="text-stone-200 whitespace-nowrap">{badge.text}</span>
            </div>
          ))}
        </div>

        {/* Enquiry Form Card */}
        <div className="bg-white/3 backdrop-blur-xl rounded-[2.5rem] p-6 sm:p-10 border border-white/10 shadow-2xl relative ring-1 ring-white/5 mb-12">
          <div className="absolute inset-0 overflow-hidden rounded-[2.5rem] pointer-events-none">
            <div className="absolute -top-32 -left-32 w-64 h-64 bg-[#fdcc4b]/10 blur-[100px] rounded-full" />
          </div>

          <div className="mb-8 text-center relative z-10">
            <h3 className="text-2xl sm:text-4xl font-black text-white tracking-tighter uppercase leading-none">Private Hire</h3>
            <p className="text-stone-500 text-xs sm:text-base mt-2 font-medium">Fill in your details and we&apos;ll confirm availability.</p>
          </div>

          <div className="relative z-10">
            <PrivateHireForm subtypes={subtypes} />
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
