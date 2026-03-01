import React from 'react'
import BookingForm from "../_components/booking-form";
import { Calendar, Clock, MapPin, Users } from "lucide-react";
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
        <div className="flex flex-col items-center sm:items-start text-center sm:text-left mb-8">
          <div className="flex flex-row sm:flex-row items-center gap-6 sm:gap-6 mb-4">
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-full overflow-hidden border-2 border-[#fdcc4b] shadow-[0_0_15px_rgba(253,204,75,0.3)] transition-all duration-300">
              <Image 
                src="/logo.jpeg" 
                alt="Don Fenticas Logo" 
                fill
                className="object-cover"
                priority
              />
            </div>
            <Image 
              src="/papajohns.png" 
              alt="Don Fenticas Quiz Night"
              width={400}
              height={120} 
              className="w-56 sm:w-72 md:w-80 h-auto object-contain bg-transparent" 
              priority
            />
          </div>

          <p className="text-sm sm:text-base text-[#f8f7f6]/80 max-w-md mx-auto sm:mx-0">
            Eight rounds. Countless bragging rights. One winning team. Welcome to Quiz Night at Don Fenticas.
          </p>
        </div>



        {/* Quick Event Badges (Saves vertical scrolling space!) */}
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          <div className="flex items-center bg-black/20 border border-[#fdcc4b]/20 rounded-full px-3 py-1.5 text-sm">
            <Calendar className="w-4 h-4 mr-2 opacity-80" />
            <span>Thursdays</span>
          </div>
          <div className="flex items-center bg-black/20 border border-[#fdcc4b]/20 rounded-full px-3 py-1.5 text-sm">
            <Clock className="w-4 h-4 mr-2 opacity-80" />
            <span>8:00 PM</span>
          </div>
          <div className="flex items-center bg-black/20 border border-[#fdcc4b]/20 rounded-full px-3 py-1.5 text-sm">
            <Users className="w-4 h-4 mr-2 opacity-80" />
            <span>Max 6 per team</span>
          </div>
          <div className="flex items-center bg-black/20 border border-[#fdcc4b]/20 rounded-full px-3 py-1.5 text-sm">
            <MapPin className="w-4 h-4 mr-2 opacity-80" />
            <span>Don Fenticas</span>
          </div>
        </div>

        {/* Booking Form Card */}
        <div className="bg-[#1e260a] rounded-3xl p-5 sm:p-8 border border-[#fdcc4b]/30 shadow-2xl">
          <div className="mb-6">
            <h3 className="text-2xl font-bold mb-1 text-white">Reserve Your Table</h3>
            <p className="text-[#fdcc4b]/70 text-sm">Lock in your team before we sell out.</p>
          </div>

          <BookingForm />

        </div>

      </div>
    </main>
  );
}
