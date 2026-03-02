import React from "react";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { CalendarDays, Users, User, Beer, CheckCircle, XCircle } from "lucide-react";
import CancelButton from "./_components/cancel-button";

export const metadata = {
  title: "Manage Booking | Bar App",
};

export default async function ManageBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Await the params for Next.js 15 compatibility
  const { id } = await params;
  const supabase = await createClient();

  // Fetch the booking, joining with events and contacts to get all the data
  const { data: booking, error } = await supabase
    .from("bookings")
    .select(`
      *,
      events (event_date: date, event_title: title),
      contacts (full_name, email)
    `)
    .eq("id", id)
    .single();

    console.log(booking);
  // If the booking doesn't exist or isn't a valid ID, show a 404 page
  if (error || !booking) {
    notFound();
  }

  const isCancelled = booking.status === "cancelled";
  const eventDate = booking.events?.event_date ? new Date(booking.events.event_date) : null;

  return (
    <main className="min-h-screen bg-[#26300D] text-[#fdcc4b] py-12 px-4 sm:px-6 lg:px-8 selection:bg-[#fdcc4b] selection:text-[#26300D]">
      <div className="max-w-xl mx-auto">
        
        <div className="bg-linear-to-b from-[#1e260a] to-[#151a07] rounded-3xl p-6 sm:p-10 border border-[#fdcc4b]/30 shadow-2xl relative overflow-hidden">
          {/* Subtle glow effect behind the content */}
          <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-md h-32 blur-3xl pointer-events-none rounded-full ${isCancelled ? 'bg-red-500/5' : 'bg-[#fdcc4b]/5'}`}></div>
          
          {/* Header */}
          <div className="relative z-10 text-center mb-8">
            {isCancelled ? (
              <XCircle className="mx-auto h-20 w-20 text-red-500 mb-4 drop-shadow-[0_0_15px_rgba(239,68,68,0.3)]" />
            ) : (
              <CheckCircle className="mx-auto h-20 w-20 text-[#fdcc4b] mb-4 drop-shadow-[0_0_15px_rgba(253,204,75,0.3)]" />
            )}
            
            <h1 className="text-3xl font-black text-white tracking-wide uppercase">
              {isCancelled ? "Booking Cancelled" : "You're Locked In!"}
            </h1>
            <p className="text-[#fdcc4b]/70 mt-2 font-medium">Booking Reference: #{booking.id}</p>
          </div>

          {/* Booking Details Card */}
          <div className="relative z-10 bg-black/40 rounded-2xl p-6 border border-[#fdcc4b]/20 space-y-5">
            
            {/* Date */}
            <div className="flex items-center">
              <div className="bg-black/40 p-3 rounded-xl mr-4 border border-[#fdcc4b]/10">
                <CalendarDays className="w-6 h-6 text-[#fdcc4b]/80" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#fdcc4b]/70 uppercase tracking-wider">Date</p>
                <p className="text-white font-medium text-lg">
                  {eventDate ? format(eventDate, "do MMMM yyyy") : "Unknown Date"}
                </p>
              </div>
            </div>

            {/* Team Name */}
            <div className="flex items-center">
              <div className="bg-black/40 p-3 rounded-xl mr-4 border border-[#fdcc4b]/10">
                <Beer className="w-6 h-6 text-[#fdcc4b]/80" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#fdcc4b]/70 uppercase tracking-wider">Team Name</p>
                <p className="text-white font-medium text-lg">{booking.group_name || "N/A"}</p>
              </div>
            </div>

            {/* Team Size */}
            <div className="flex items-center">
              <div className="bg-black/40 p-3 rounded-xl mr-4 border border-[#fdcc4b]/10">
                <Users className="w-6 h-6 text-[#fdcc4b]/80" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#fdcc4b]/70 uppercase tracking-wider">Team Size</p>
                <p className="text-white font-medium text-lg">{booking.group_size} People</p>
              </div>
            </div>

            {/* Contact Name */}
            <div className="flex items-center">
              <div className="bg-black/40 p-3 rounded-xl mr-4 border border-[#fdcc4b]/10">
                <User className="w-6 h-6 text-[#fdcc4b]/80" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#fdcc4b]/70 uppercase tracking-wider">Booked By</p>
                <p className="text-white font-medium text-lg">
                  {booking.contacts?.full_name || "N/A"}
                </p>
              </div>
            </div>

          </div>

          {/* Action Button */}
         {!isCancelled && (
   <div className="relative z-10">
     <CancelButton 
       bookingId={booking.id} 
       currentTeamName={booking.group_name} 
       currentTeamSize={booking.group_size} 
     />
   </div>
)}

        </div>
      </div>
    </main>
  );
}