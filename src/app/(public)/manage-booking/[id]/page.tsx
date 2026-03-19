import React from "react";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import CancelButton from "./_components/cancel-button";

export const metadata = {
  title: "Manage Booking | Don Fenticas",
};

export default async function ManageBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Await the params for Next.js 15 compatibility
  const { id } = await params;
  const supabase = await createClient();

  // Fetch the booking, joining with events and contacts
  const { data: booking, error } = await supabase
    .from("bookings")
    .select(`
      *,
      events (event_date: date, event_title: title),
      contacts (full_name, email)
    `)
    .eq("id", id)
    .single();

  if (error || !booking) {
    notFound();
  }

  const isCancelled = booking.status === "cancelled";

  return (
    <main className="min-h-dvh w-full overflow-x-hidden bg-[#26300D] text-[#fdcc4b] flex flex-col selection:bg-[#fdcc4b] selection:text-[#26300D] antialiased">
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
          padding-top: env(safe-area-inset-top, 0px);
          padding-bottom: env(safe-area-inset-bottom, 20px);
        }
      `}} />

      {/* Reduced py-12 to py-6 on mobile, and adjusted max-width for tighter feel */}
      <div className="flex-1 w-full max-w-xl mx-auto py-6 sm:py-12 px-4 sm:px-6 flex flex-col justify-center">
        
        {/* Adjusted padding on the card itself for mobile (p-5 vs p-10) */}
        <div className="bg-linear-to-b from-[#1e260a] to-[#151a07] rounded-3xl p-5 sm:p-10 border border-[#fdcc4b]/30 shadow-2xl relative overflow-hidden">
          <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-md h-32 blur-3xl pointer-events-none rounded-full ${isCancelled ? 'bg-red-500/5' : 'bg-[#fdcc4b]/5'}`}></div>
          
          {/* The details card and header logic have been moved into CancelButton 
            so that the component can hide them when 'isEditing' is true.
          */}
          <div className="relative z-10">
            <CancelButton 
              booking={booking} 
              isCancelled={isCancelled}
            />
          </div>
        </div>
        
        {/* More compact footer spacing */}
        <div className="mt-8 sm:mt-auto pt-4 text-center opacity-40">
           <p className="text-[10px] font-black uppercase tracking-[0.4em]">Don Fenticas</p>
        </div>
      </div>
    </main>
  );
}
