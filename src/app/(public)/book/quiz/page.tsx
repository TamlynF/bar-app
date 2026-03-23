import React from 'react'
import BookingForm from "@/app/(public)/book/quiz/_components/quiz-booking-form";
import { 
  Calendar, Banknote, Users, Trophy, Wine, 
  MapPin, Clock, DollarSign, Star, CheckCircle, 
  Music, Utensils, GlassWater, Heart, Smile, 
  Sparkles, AlertCircle, Beer, Info
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import Image from 'next/image';
import { cn } from "@/lib/utils";

export const metadata = {
  title: 'Book a Quiz | Don Fenticas',
  description: 'Secure your spot for our next quiz night.',
};

// Map of available icons to match strings stored in database
const ICON_MAP: Record<string, React.ElementType> = {
  Banknote, Calendar, Users, Trophy, Wine,
  MapPin, Clock, DollarSign, Star, CheckCircle,
  Music, Utensils, GlassWater, Heart, Smile,
  Sparkles, AlertCircle, Beer, Info
};

export default async function QuizBookingPage() {
  const supabase = await createClient();

  const { data: infoItems } = await supabase
    .from("event_information")
    .select(`
      icon,
      title,
      event_types!inner (
        type,
        sub_type
      )
    `)
    .eq("event_types.type", "game")
    .eq("event_types.sub_type", "quiz");
  
  // Map database items to badge format
  const dbBadges = (infoItems || []).map(item => ({
    icon: ICON_MAP[item.icon || ""] || Info,
    text: item.title
  }));

  // Fallback to defaults if no records found in database
  const eventBadges = dbBadges.length > 0 ? dbBadges : [
    { icon: Banknote, text: "Free Entry" },
    { icon: Calendar, text: "Thursdays: 8:00PM" },
    { icon: Trophy, text: "Win Prosecco" },
    { icon: Wine, text: "Happy Hour: 6:00PM - 9:00PM" },
    { icon: Star, text: "Top Rated" },
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
        /* Custom scrollbar hiding utility */
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
      
      <div className="flex-1 w-full max-w-3xl mx-auto py-4 sm:py-12 px-4 sm:px-6 lg:px-8 flex flex-col">

        {/* Header Section 
            - Constrained image size on mobile to prevent a 'messy' or oversized appearance.
            - Added 'priority' for LCP optimization.
        */}
        <div className="flex flex-col items-center text-center mb-6 sm:mb-10">
          <div className="w-full max-w-[200px] sm:max-w-md transition-transform duration-700 hover:scale-[1.02] active:scale-[0.98] relative aspect-600/260">
            <Image
              src="/DF X PJ Quiz Night.png"
              alt="Don Fenticas x Papa Johns Quiz Night"
              width={300}
              height={150}
              className="w-full h-auto object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.3)]"
              priority
            />
          </div>
          <div className="mt-4 sm:mt-6 space-y-2 px-2">
            <p className="text-stone-400 text-xs sm:text-base font-medium max-w-sm mx-auto leading-relaxed italic opacity-80 text-center">
              Eight rounds. Countless bragging rights. One winning team. Welcome to Quiz Night at Don Fenticas.
            </p>
          </div>
        </div>

        {/* Event Badges - Horizontal Scroll on Mobile, Full Width Dynamic Grid on Desktop */}
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
          <div className="absolute -top-32 -left-32 w-64 h-64 bg-[#fdcc4b]/10 blur-[100px] rounded-full pointer-events-none"></div>

          <div className="mb-8 text-center relative z-10">
            <h3 className="text-2xl sm:text-4xl font-black text-white tracking-tighter uppercase leading-none">Book Your Table</h3>
            <p className="text-stone-500 text-xs sm:text-base mt-2 font-medium">Lock in your team before we are fully booked.</p>
          </div>

          <div className="relative z-10">
            <BookingForm />
          </div>
        </div>

        {/* Footer info */}
        <div className="pt-8 mt-auto mb-6 flex flex-col items-center gap-4">
          <div className="flex items-center gap-4 text-stone-800">
            <div className="h-px w-6 bg-stone-800/50"></div>
            <span className="text-[9px] font-bold uppercase tracking-[0.4em]">Don Fenticas</span>
            <div className="h-px w-6 bg-stone-800/50"></div>
          </div>
          <p className="text-[8px] text-stone-600 uppercase tracking-widest opacity-30">
            Licensed Venue • Please Drink Responsibly
          </p>
        </div>
      </div>
    </main>
  );
}
