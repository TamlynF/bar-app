import React from "react";
import Link from "next/link";
import { 
  Trophy, 
  Music, 
  Lock, 
  ChevronRight, 
  Speaker
} from "lucide-react";

const eventBookingItems = [
  {
    title: "Bingo Bookings",
    description: "Manage bingo teams, seating and scores",
    href: "/event-bookings/bingo-bookings",
    icon: Speaker,
    color: "bg-green-500/10 text-green-600",
  },
  {
    title: "Music Bookings",
    description: "Schedule bands and live entertainment",
    href: "/event-bookings/music-bookings",
    icon: Music,
    color: "bg-amber-500/10 text-amber-600",
  },
  {
    title: "Private Event Bookings",
    description: "Enquiries and venue hire pipeline",
    href: "/event-bookings/private-bookings",
    icon: Lock,
    color: "bg-purple-500/10 text-purple-600",
  },
   {
    title: "Quiz Bookings",
    description: "Manage quiz teams, seating and scores",
    href: "/event-bookings/quiz-bookings",
    icon: Trophy,
    color: "bg-blue-500/10 text-blue-600",
  },
];

export default async function EventsHubPage() {
  return (
    <div className="p-2 sm:p-8 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {eventBookingItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex items-center justify-between p-3 bg-white border border-[#E6DFC8] rounded-3xl shadow-sm hover:border-[#26300D] hover:shadow-md transition-all active:scale-[0.98]"
          >
            <div className="flex items-center gap-4">
              {/* Icon Container with hover animation */}
              <div className={`w-12 h-12 rounded-2xl ${item.color} flex items-center justify-center shrink-0 transition-transform group-hover:scale-110`}>
                <item.icon className="w-6 h-6" />
              </div>
              
              {/* Text Labels */}
              <div className="flex flex-col text-left">
                <span className="font-black text-[#1F1F1A] uppercase tracking-tight leading-none">
                  {item.title}
                </span>
                <span className="text-[11px] text-[#5F624F] font-bold opacity-60 uppercase mt-1.5 tracking-wider">
                  {item.description}
                </span>
              </div>
            </div>

            {/* Trailing Chevron */}
            <ChevronRight className="w-5 h-5 text-[#E6DFC8] group-hover:text-[#26300D] transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}