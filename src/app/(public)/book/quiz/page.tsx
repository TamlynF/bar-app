import React from 'react'
import BookingForm, { type QuizEvent } from "@/app/(public)/book/quiz/_components/quiz-booking-form";
import { 
  Calendar, Banknote, Users, Trophy, Wine, 
  MapPin, Clock, DollarSign, Star, CheckCircle, 
  Music, Utensils, GlassWater, Heart, Smile, 
  Sparkles, AlertCircle, Beer, Info, Speaker, User, Ghost
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import Image from 'next/image';
import { cn } from "@/lib/utils";

export const metadata = {
  title: 'Book a Quiz | Don Fenticas',
  description: 'Secure your spot for our next quiz night.',
};

const ICON_MAP: Record<string, React.ElementType> = {
  Banknote, Calendar, Users, Trophy, Wine,
  MapPin, Clock, DollarSign, Star, CheckCircle,
  Music, Utensils, GlassWater, Heart, Smile,
  Sparkles, AlertCircle, Beer, Info, Speaker, User, Ghost
};

export default async function QuizBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: preselect } = await searchParams;
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  const [{ data: rawEvents }, { data: infoItems }, { data: subtypeRow }] = await Promise.all([
    supabase
      .from("events")
      .select("id, date, start_time, payment_amount, is_fully_booked, event_subtypes!inner(behavior)")
      .eq("event_subtypes.behavior", "quiz")
      .eq("is_active", true)
      .gte("date", today)
      .order("date", { ascending: true }),
    supabase
      .from("event_subtype_badges")
      .select(`
        icon,
        title,
        event_subtypes!inner (
          behavior
        )
      `)
      .eq("event_subtypes.behavior", "quiz"),
    supabase
      .from("event_subtypes")
      .select("tagline")
      .eq("behavior", "quiz")
      .limit(1)
      .maybeSingle(),
  ]);

  const tagline = (subtypeRow?.tagline as string | null) || "Eight rounds. Countless bragging rights. One winning team. Welcome to Quiz Night at Don Fenticas.";

  const events: QuizEvent[] = (rawEvents ?? []).map((e) => ({
    id: e.id as number,
    date: e.date as string,
    start_time: (e.start_time as string | null) ?? null,
    payment_amount: e.payment_amount as number | null,
    is_fully_booked: (e.is_fully_booked as boolean) ?? false,
  }));

  if (preselect) {
    events.sort((a, b) => (a.date === preselect ? -1 : b.date === preselect ? 1 : 0));
  }

  const dbBadges = (infoItems || []).map(item => ({
    icon: ICON_MAP[item.icon || ""] || Info,
    text: item.title
  }));

  const eventBadges = dbBadges.length > 0 ? dbBadges : [
    { icon: Banknote, text: "Free Entry" },
    { icon: Calendar, text: "Thursdays: 8:00PM" },
    { icon: Trophy, text: "Win Prosecco" },
    { icon: Wine, text: "Happy Hour: 6:00PM - 9:00PM" },
    { icon: Star, text: "Top Rated" },
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
        /* Custom scrollbar hiding utility */
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
      
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-4 sm:px-6 sm:py-12 lg:px-8">

        <div className="mb-6 flex flex-col items-center text-center sm:mb-10">
          <div className="relative aspect-600/260 w-full max-w-50 transition-transform duration-700 hover:scale-[1.02] active:scale-[0.98] sm:max-w-md">
            <Image
              src="/DF X PJ Quiz Night.png"
              alt="Don Fenticas x Papa Johns Quiz Night"
              width={300}
              height={150}
              className="h-auto w-full object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.3)]"
              priority
            />
          </div>
          <div className="mt-4 space-y-2 px-2 sm:mt-6">
            <p className="mx-auto max-w-sm text-center text-xs leading-relaxed font-medium text-stone-400 italic opacity-80 sm:text-base">
              {tagline}
            </p>
          </div>
        </div>

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

        <div className="relative mb-12 overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/3 p-6 shadow-2xl ring-1 ring-white/5 backdrop-blur-xl sm:p-10">
          <div className="pointer-events-none absolute -top-32 -left-32 h-64 w-64 rounded-full bg-[#fdcc4b]/10 blur-[100px]"></div>

          <div className="relative z-10 mb-8 text-center">
            <h3 className="font-black text-2xl leading-none tracking-tighter text-white uppercase sm:text-4xl">Book Your Table</h3>
            <p className="mt-2 text-xs font-medium text-stone-500 sm:text-base">
              {events.length > 0
                ? "Lock in your team before we are fully booked."
                : "Check back soon for upcoming events."}
            </p>
          </div>

          <div className="relative z-10">
            {events.length > 0 ? (
              <BookingForm events={events} />
            ) : (
              <div className="py-8 text-center">
                <p className="mb-2 font-black text-lg tracking-tight text-stone-300 uppercase">No Upcoming Events</p>
                <p className="text-sm font-medium text-stone-500">There are no quiz nights scheduled yet. Please check back soon!</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-auto mb-6 flex flex-col items-center gap-4 pt-8">
          <div className="flex items-center gap-4 text-stone-800">
            <div className="h-px w-6 bg-stone-800/50"></div>
            <span className="text-[9px] font-bold tracking-[0.4em] uppercase">Don Fenticas</span>
            <div className="h-px w-6 bg-stone-800/50"></div>
          </div>
          <p className="text-[8px] tracking-widest text-stone-600 uppercase opacity-30">
            Licensed Venue • Please Drink Responsibly
          </p>
        </div>
      </div>
    </main>
  );
}
