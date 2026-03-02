import React from 'react'
import BookingForm from "../_components/booking-form";
import { Calendar, Banknote, Users, Trophy, Wine } from "lucide-react";
import Image from "next/image";

export const metadata = {
  title: 'Book a Quiz | Bar App',
  description: 'Secure your spot for our next quiz night.',
};

export default function QuizBookingPage() {
  const eventBadges = [
    { icon: Banknote, text: "Free Entry" },
    { icon: Calendar, text: "Thursdays: 8:00PM" },
    { icon: Users, text: "Max 6 per team" },
    { icon: Trophy, text: "Win Prosecco" },
    { icon: Wine, text: "Happy Hour: 6:00PM - 9:00PM" },
  ];

  return (
    <main className="min-h-screen bg-[#26300D] text-[#fdcc4b] py-1 sm:py-8 px-4 sm:px-6 lg:px-8 selection:bg-[#fdcc4b] selection:text-[#26300D] overflow-hidden">
      <div className="max-w-4xl mx-auto">

        {/* Header Section */}
        <div className="flex flex-col items-center text-center mb-8">
          <Image
            src="/DF X PJ Quiz Night.png"
            alt="Don Fenticas x Papa Johns Quiz Night"
            width={600}
            height={260}
            className="w-full max-w-70 sm:max-w-100 md:max-w-125 object-contain drop-shadow-2xl z-10"
            priority
          />
          <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-[#dcf5c7]/90 font-sans max-w-md mx-auto px-4">
            Eight rounds. Countless bragging rights. One winning team. Welcome to Quiz Night at Don Fenticas.
          </p>
        </div>

        {/* Event Badges - Horizontal Scrollable Row */}
        <div className="mb-5 -mx-4 px-4 sm:mx-0 sm:px-0 relative">
          {/* Subtle gradient indicators for scroll overflow on mobile */}
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-linear-to-r from-[#26300D] to-transparent pointer-events-none sm:hidden z-10"></div>
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-linear-to-l from-[#26300D] to-transparent pointer-events-none sm:hidden z-10"></div>

          <div className="flex flex-nowrap gap-1 overflow-x-auto pb-2 no-scrollbar scroll-smooth snap-x">
            {eventBadges.map((badge, index) => (
              <div
                key={index}
                className="flex-none snap-center flex items-center bg-black/20 border border-[#fdcc4b]/40 shadow-sm rounded-full px-4 py-2 text-xs text-white sm:text-sm whitespace-nowrap transition-colors hover:bg-black/40 hover:border-[#fdcc4b]"
              >
                <badge.icon className="w-4 h-4 mr-2 text-[#fdcc4b]" />
                <span className="font-medium tracking-wide">{badge.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Booking Form Card */}
        <div className="bg-linear-to-b from-[#1e260a] to-[#151a07] rounded-3xl p-5 sm:p-8 border border-[#fdcc4b]/30 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-md h-32 bg-[#fdcc4b]/5 blur-3xl pointer-events-none rounded-full"></div>
          <div className="mb-6 text-center sm:text-left relative z-10">
            <h3 className="text-2xl font-bold mb-1 text-white tracking-wide uppercase">Reserve Your Table</h3>
            <p className="text-[#fdcc4b]/70 text-sm font-medium">Lock in your team before we are fully booked.</p>
          </div>

          <div className="relative z-10">
            <BookingForm />
          </div>

        </div>

      </div>
    </main>
  );
}
