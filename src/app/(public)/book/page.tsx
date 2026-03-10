import React from 'react'
import BookingForm from "../_components/booking-form";
import { 
  Calendar, Banknote, Users, Trophy, Wine, 
  MapPin, Clock, DollarSign, Star, CheckCircle, 
  Music, Utensils, GlassWater, Heart, Smile, 
  Sparkles, AlertCircle, Beer, Info
} from "lucide-react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";

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
  
    // Map database items to badge format, falling back to Info icon if map fails
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
  ];

  // const eventBadges = [
  //   { icon: Banknote, text: "Free Entry" },
  //   { icon: Calendar, text: "Thursdays: 8:00PM" },
  //   // { icon: Users, text: "Max 6 per team" },
  //   { icon: Trophy, text: "Win Prosecco" },
  //   { icon: Wine, text: "Happy Hour: 6:00PM - 9:00PM" },
  // ];

  return (
    <main className="min-h-screen bg-[#26300D] text-stone-300 py-6 sm:py-12 px-4 sm:px-6 lg:px-8 selection:bg-[#fdcc4b] selection:text-[#26300D] antialiased">
      <div className="max-w-3xl mx-auto">

        {/* Header Section */}
        <div className="flex flex-col items-center text-center mb-8 sm:mb-12">
          <div className="w-full max-w-60 sm:max-w-105 transition-transform duration-700 hover:scale-[1.02] active:scale-[0.98]">
            <Image
              src="/DF X PJ Quiz Night.png"
              alt="Don Fenticas x Papa Johns Quiz Night"
              width={600}
              height={260}
              className="w-full h-auto object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
              priority
            />
          </div>
          <div className="mt-6 space-y-2 px-4">
            {/* <h1 className="text-white text-xs sm:text-sm font-black uppercase tracking-[0.3em] opacity-80">Weekly Pub Trivia</h1> */}
            <p className="text-stone-400 text-sm sm:text-base font-medium max-w-sm mx-auto leading-relaxed italic">
              Eight rounds. Countless bragging rights. One winning team. Welcome to Quiz Night at Don Fenticas.
            </p>
          </div>
        </div>

        {/* Event Badges - Horizontal Scrollable Row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3 mb-8 sm:mb-12">
          {eventBadges.map((badge, index) => (
            <div
              key={index}
              className={`flex items-center justify-center bg-white/3 border border-white/8 rounded-xl px-3 py-3 text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all hover:bg-white/8 
                ${index === eventBadges.length - 1 && eventBadges.length % 2 !== 0 ? "col-span-2 sm:col-span-1" : ""
                }`}
            >
              <badge.icon className="w-3.5 h-3.5 mr-2 text-[#fdcc4b] shrink-0" />
              <span className="truncate text-stone-200">{badge.text}</span>
            </div>
          ))}
        </div>

        {/* Booking Form Card */}
        <div className="bg-white/3 backdrop-blur-xl rounded-[2.5rem] p-6 sm:p-10 border border-white/10 shadow-2xl relative overflow-hidden ring-1 ring-white/5">
          <div className="absolute -top-32 -left-32 w-64 h-64 bg-[#fdcc4b]/10 blur-[100px] rounded-full pointer-events-none"></div>

          <div className="mb-8 text-center sm:text-left relative z-10 pl-1">
            {/* <div className="inline-block px-3 py-1 rounded-full bg-[#fdcc4b]/10 border border-[#fdcc4b]/20 text-[#fdcc4b] text-[10px] font-black uppercase tracking-widest mb-3">
              Limited Tables
            </div> */}
            <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase leading-none">Book Your Table</h3>
            <p className="text-stone-500 text-xs sm:text-sm mt-2 font-medium">Lock in your team before we are fully booked.</p>
          </div>

          <div className="relative z-10">
            <BookingForm />
          </div>
        </div>
        <div className="mt-12 mb-6 flex flex-col items-center gap-6">
          <div className="flex items-center gap-4 text-stone-600">
            <div className="h-px w-8 bg-stone-800"></div>
            <span className="text-[10px] font-bold uppercase tracking-[0.4em]">Don Fenticas</span>
            <div className="h-px w-8 bg-stone-800"></div>
          </div>
          <p className="text-[9px] text-stone-500 uppercase tracking-widest opacity-50">
            Licensed Venue • Please Drink Responsibly
          </p>
        </div>
      </div>
    </main>
  );
}
