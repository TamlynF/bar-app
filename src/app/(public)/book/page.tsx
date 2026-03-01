import React from 'react'
import BookingForm from "../_components/booking-form"; // Note: Adjust this import if your component is not the default export
import { Calendar, Clock, MapPin, Users } from "lucide-react";

export const metadata = {
  title: 'Book a Quiz | Bar App',
  description: 'Secure your spot for our next quiz night.',
};

export default async function QuizBookingPage() {

  return (
    <main className="min-h-screen bg-[#26300D] text-[#fdcc4b] py-8 px-4 sm:px-6 lg:px-8 selection:bg-[#fdcc4b] selection:text-[#26300D]">
      <div className="max-w-2xl mx-auto">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row items-center justify-center sm:text-left text-center mb-8 gap-4 sm:gap-6">
          <div className="w-24 h-24 flex-shrink-0 rounded-full overflow-hidden border-2 border-[#fdcc4b] shadow-[0_0_15px_rgba(253,204,75,0.3)]">
            <img 
              src="/logo.jpeg" 
              alt="Don Fenticas Logo" 
              className="w-full h-full object-cover"
              // onError={(e) => {
              //   e.currentTarget.src = "https://placehold.co/100x100/26300D/fdcc4b?text=DF";
              // }}
            />
          </div>
          <div className="flex flex-col">
            <img 
              src="/DF Name no background .png" 
              alt="Don Fenticas Quiz Night" 
              className="w-auto h-16 object-contain mb-2 mx-auto sm:mx-0" 
              //onError={(e) => {
                // Fallback text just in case the image fails to load
                //e.currentTarget.outerHTML = '<h1 class="text-3xl font-extrabold tracking-tight sm:text-4xl uppercase mb-2">Don Fenticas Quiz Night</h1>';
              //}}
            />
          <p className="text-sm sm:text-base text-[#fdcc4b]/80 max-w-md">
            Eight rounds. Countless bragging rights. One winning team. Welcome to Quiz Night at Don Fenticas.
            </p>
            </div>
        </div>

        
        
        {/* Quick Event Badges (Saves vertical scrolling space!) */}
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          <div className="flex items-center bg-black/20 border border-[#fdcc4b]/20 rounded-full px-3 py-1.5 text-sm">
            <Calendar className="w-4 h-4 mr-2 opacity-80" />
            <span>Every Thursday</span>
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
