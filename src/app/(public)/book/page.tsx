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
    <main className="min-h-screen bg-[#26300D] text-[#fdcc4b] py-8 px-4 sm:px-6 lg:px-8 selection:bg-[#fdcc4b] selection:text-[#26300D]">
      <div className="max-w-2xl mx-auto">

        {/* Header Section */}
        <div className="flex flex-col items-center text-center mb-4">
            <Image
              src="/DF X PJ Quiz Night.png"
              alt="Don Fenticas x Papa Johns Quiz Night"
              width={600}
              height={200}
              className="w-55 sm:w-75 md:w-100 h-auto object-contain drop-shadow-2xl z-10"
              priority
            />
          <p className="text-sm sm:text-base text-[#f5f4f0]/80 max-w-md mx-auto -mt-2 sm:-mt-4">
            Eight rounds. Countless bragging rights. One winning team. Welcome to Quiz Night at Don Fenticas.
          </p>
        </div>

        {/* Quick Event Badges (Saves vertical scrolling space!) */}
        <div className="flex flex-wrap justify-center gap-1 mb-4">
          <div className="flex items-center bg-black/20 border border-[#fdcc4b]/20 rounded-full px-3 py-1.5 text-sm">
            <Calendar className="w-4 h-4 mr-2 opacity-80" />
            <span>Thursdays: 8PM</span>
          </div>
          <div className="flex items-center bg-black/20 border border-[#fdcc4b]/20 rounded-full px-3 py-1.5 text-sm">
            <Users className="w-4 h-4 mr-2 opacity-80" />
            <span>Max 6 per team</span>
          </div>          
          <div className="flex items-center bg-black/20 border border-[#fdcc4b]/20 rounded-full px-3 py-1.5 text-sm">
            <Trophy className="w-4 h-4 mr-2 opacity-80" />
            <span>Win Preseco</span>
          </div>
          <div className="flex items-center bg-black/20 border border-[#fdcc4b]/20 rounded-full px-3 py-1.5 text-sm">
            <Wine className="w-4 h-4 mr-2 opacity-80" />
            <span>Happy hour: 6-9PM</span>
          </div>
          <div className="flex items-center bg-black/20 border border-[#fdcc4b]/20 rounded-full px-3 py-1.5 text-sm">
            <MapPin className="w-4 h-4 mr-2 opacity-80" />
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
