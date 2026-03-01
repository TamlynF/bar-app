import React from 'react'
import BookingForm from "../_components/booking-form";
import { Calendar, Clock, MapPin, Users, Trophy, Wine } from "lucide-react";
import Image from "next/image";

export const metadata = {
  title: 'Book a Quiz | Bar App',
  description: 'Secure your spot for our next quiz night.',
};

export default function QuizBookingPage() {

  return (
    <main className="min-h-screen bg-[#26300D] text-[#fdcc4b] py-6 sm:py-8 px-4 sm:px-6 lg:px-8 selection:bg-[#fdcc4b] selection:text-[#26300D]">
      <div className="max-w-3xl mx-auto">

        {/* Header Section */}
        <div className="flex flex-col items-center text-center mb-6">
          <Image
            src="/DF X PJ Quiz Night.png"
            alt="Don Fenticas x Papa Johns Quiz Night"
            width={700}
            height={230}
            className="w-full max-w-[320px] sm:max-w-125 md:max-w-175 h-auto object-contain drop-shadow-2xl z-10"
            priority
          />
          <p className="text-sm sm:text-base text-[#fffffe]/80 font-semibold max-w-md mx-auto -mt-1 sm:-mt-1">
            Eight rounds. Countless bragging rights. One winning team. Welcome to Quiz Night at Don Fenticas.
          </p>
        </div>

        {/* Event Badges - Condensing the grid to be much tighter */}
        <div className="flex flex-wrap justify-center gap-2 mb-4 max-w-2xl mx-auto">

          {/* Top Row: Basic Info */}
          <div className="flex items-center justify-center gap-2 w-full sm:w-auto">
            <div className="flex items-center bg-black/20 border border-[#fdcc4b]/10 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm whitespace-nowrap">
              <Calendar className="w-3.5 h-3.5 mr-1.5 opacity-80" />
              <span>Thursdays - 8PM</span>
            </div>
            <div className="flex items-center bg-black/20 border border-[#fdcc4b]/10 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm whitespace-nowrap">
              <Users className="w-3.5 h-3.5 mr-1.5 opacity-80" />
              <span>Max 6 per team</span>
            </div>
            <div className="flex items-center bg-black/20 border border-[#fdcc4b]/10 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm whitespace-nowrap">
              <Trophy className="w-3.5 h-3.5 mr-1.5 opacity-80" />
              <span>Win Preseco</span>
            </div>
            
          </div>

          <div className="flex items-center bg-black/20 border border-[#fdcc4b]/10 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm whitespace-nowrap">
              <Wine className="w-3.5 h-3.5 mr-1.5 opacity-80" />
              <span>Happy Hour - 6-9PM</span>
          </div>
          
          {/* Location */}
          <div className="flex items-center bg-black/20 border border-[#fdcc4b]/10 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm">
            <MapPin className="w-3.5 h-3.5 mr-1.5 opacity-80" />
            <span>Don Fenticas</span>
          </div>
        </div>

        {/* Booking Form Card */}
        <div className="bg-[#1e260a] rounded-3xl p-5 sm:p-8 border border-[#fdcc4b]/30 shadow-2xl">
          <div className="mb-6 text-center sm:text-left">
            <h3 className="text-2xl font-bold mb-1 text-white">Reserve Your Table</h3>
            <p className="text-[#fdcc4b]/70 text-sm">Lock in your team before we sell out.</p>
          </div>

          <BookingForm />

        </div>

      </div>
    </main>
  );
}
