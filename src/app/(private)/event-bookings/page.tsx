export const dynamic = "force-dynamic";

import React from "react";
import Link from "next/link";
import {
  Trophy,
  Music,
  Lock,
  ChevronRight,
  Speaker,
  CalendarDays,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

const eventBookingItems = [
  {
    title: "Bingo Bookings",
    description: "Manage bingo teams, seating and scores",
    href: "/event-bookings/bingo-bookings",
    icon: Speaker,
    color: "bg-purple-50 text-purple-600",
  },
  {
    title: "Music Bookings",
    description: "Schedule bands and live entertainment",
    href: "/event-bookings/music-bookings",
    icon: Music,
    color: "bg-sky-50 text-sky-600",
  },
  {
    title: "Private Event Bookings",
    description: "Enquiries and venue hire pipeline",
    href: "/event-bookings/private-bookings",
    icon: Lock,
    color: "bg-green-50 text-green-600",
  },
   {
    title: "Quiz Bookings",
    description: "Manage quiz teams, seating and scores",
    href: "/event-bookings/quiz-bookings",
    icon: Trophy,
    color: "bg-amber-50 text-amber-600",
  },
];

export default async function EventsHubPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  // Fetch all bookable events
  const { data: bookableEvents, error: evError } = await supabase
    .from("events")
    .select("id, date, title, event_types!inner(sub_type, type)")
    .eq("is_active", true)
    .eq("is_bookable", true)
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(20);

  if (evError) console.error("Failed to fetch bookable events:", evError);
  const generalEvents = bookableEvents ?? [];

  return (
    <div className="p-2 sm:p-8 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {eventBookingItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex items-center justify-between p-3 bg-white border border-[#E6DFC8] rounded-3xl shadow-sm hover:border-[#5C4033] hover:shadow-md transition-all active:scale-[0.98]"
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl ${item.color} flex items-center justify-center shrink-0 transition-transform group-hover:scale-110`}>
                <item.icon className="w-6 h-6" />
              </div>
              <div className="flex flex-col text-left">
                <span className="font-black text-[#1F1F1A] uppercase tracking-tight leading-none">
                  {item.title}
                </span>
                <span className="text-[11px] text-[#5F624F] font-bold opacity-60 uppercase mt-1.5 tracking-wider">
                  {item.description}
                </span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#E6DFC8] group-hover:text-[#5C4033] transition-colors" />
          </Link>
        ))}
      </div>

      {/* General Bookable Events */}
      {generalEvents.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-[11px] font-black uppercase tracking-wide text-[#5F624F] px-1">
            General Events
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {generalEvents.map((ev) => {
              const dateStr = new Date(ev.date + "T00:00:00").toLocaleDateString("en-GB", {
                weekday: "short", day: "numeric", month: "short",
              });
              return (
                <Link
                  key={ev.id}
                  href={`/event-bookings/event/${ev.id}`}
                  className="group flex items-center justify-between p-3 bg-white border border-[#E6DFC8] rounded-3xl shadow-sm hover:border-[#5C4033] hover:shadow-md transition-all active:scale-[0.98]"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#F7F4EA] text-[#5C4033] flex items-center justify-center shrink-0 transition-transform group-hover:scale-110">
                      <CalendarDays className="w-6 h-6" />
                    </div>
                    <div className="flex flex-col text-left min-w-0">
                      <span className="font-black text-[#1F1F1A] uppercase tracking-tight leading-none truncate">
                        {ev.title || "Event"}
                      </span>
                      <span className="text-[11px] text-[#5F624F] font-bold opacity-60 uppercase mt-1.5 tracking-wider">
                        {dateStr}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[#E6DFC8] group-hover:text-[#5C4033] transition-colors" />
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}