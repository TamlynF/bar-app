import React from 'react'
import BookingForm from "../_components/booking-form";
import { Calendar, Banknote, Users, Trophy, Wine } from "lucide-react";
import Image from "next/image";

export const metadata = {
  title: 'Book a Quiz | Bar App',
  description: 'Secure your spot for our next quiz night.',
};

export default function QuizBookingPage() {

  return (
    <main className="min-h-screen bg-[#26300D] text-[#fdcc4b] py-1 sm:py-8 px-4 sm:px-6 lg:px-8 selection:bg-[#fdcc4b] selection:text-[#26300D]">
      <div className="max-w-4xl mx-auto">

        {/* Header Section */}
        <div className="flex flex-col items-center text-center mb-5">
          <Image
            src="/DF X PJ Quiz Night.png"
            alt="Don Fenticas x Papa Johns Quiz Night"
            width={600}
            height={200}
            className="w-full max-w-[320px] sm:max-w-125 md:max-w-175 h-auto object-contain drop-shadow-2xl z-10"
            priority
          />
          <p className="-mt-7 text-xs sm:text-sm text-[#dcf5c7]/90 font-sans max-w-md mx-auto">
            Eight rounds. Countless bragging rights. One winning team. Welcome to Quiz Night at Don Fenticas.
          </p>
        </div>

        {/* Event Badges - Condensing the grid to be much tighter */}
        <div className="flex flex-wrap justify-center gap-2 mb-5 max-w-3xl mx-auto">

          {/* Top Row: Basic Info */}
          <div className="flex items-center justify-center gap-1 w-full sm:w-auto">
            <div className="flex items-center bg-black/20 border border-[#fdcc4b]/50 rounded-lg px-2.5 py-1.5 text-xs text-white sm:text-sm whitespace-nowrap">
              <Banknote className="w-3.5 h-3.5 mr-1.5 opacity-95" />
              <span>Free Entry</span>
            </div>
            <div className="flex items-center bg-black/20 border border-[#fdcc4b]/50 rounded-lg px-2.5 py-1.5 text-xs text-white sm:text-sm whitespace-nowrap">
              <Calendar className="w-3.5 h-3.5 mr-1.5 opacity-80" />
              <span>Thursdays: 8:00PM</span>
            </div>
            <div className="flex items-center bg-black/20 border border-[#fdcc4b]/50 rounded-lg px-2.5 py-1.5 text-xs text-white sm:text-sm whitespace-nowrap">
              <Users className="w-3.5 h-3.5 mr-1.5 opacity-80" />
              <span>Max 6 per team</span>
            </div>
          </div>
          <div className="flex items-center justify-center gap-1 w-full sm:w-auto">
            <div className="flex items-center bg-black/20 border border-[#fdcc4b]/50 rounded-lg px-2.5 py-1.5 text-xs text-white sm:text-sm whitespace-nowrap">
              <Trophy className="w-3.5 h-3.5 mr-1.5 opacity-80" />
              <span>Win Preseco</span>
            </div>
            <div className="flex items-center bg-black/20 border border-[#fdcc4b]/50 rounded-lg px-2.5 py-1.5 text-xs text-white sm:text-sm whitespace-nowrap">
              <Wine className="w-3.5 h-3.5 mr-1.5 opacity-80" />
              <span>Happy Hour: 6:00PM - 9:00PM</span>
            </div>
          </div>
        </div>

        {/* Booking Form Card */}
        <div className="bg-[#1e260a] rounded-3xl p-5 sm:p-8 border border-[#fdcc4b]/30 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-md h-32 bg-[#fdcc4b]/5 blur-3xl pointer-events-none rounded-full"></div>
          <div className="mb-6 text-center sm:text-left relative z-10">
            <h3 className="text-2xl font-bold mb-1 text-white tracking-wide uppercase">Reserve Your Table</h3>
            <p className="text-[#fdcc4b]/70 text-sm font-medium">Lock in your team before we sell out.</p>
          </div>

          <div className="relative z-10">
            <BookingForm />
          </div>

        </div>

      </div>
    </main>
  );
}
