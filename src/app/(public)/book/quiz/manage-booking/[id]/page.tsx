import React from "react";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import CancelButton from "./_components/cancel-button";
import type { ManageBooking } from "./_components/cancel-button";

export const metadata = {
  title: "Manage Booking | Don Fenticas",
};

export default async function ManageBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetched special_requests in the select query
  const { data: booking, error } = await supabase
    .from("bookings")
    .select(`
      *,
      special_requests,
      events!bookings_event_id_fkey (id, event_date: date, event_title: title),
      contacts!bookings_contact_id_fkey (full_name, email),
      booking_table_mappings (
        tables (id, name, max_capacity)
      )
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

      <div className="flex-1 w-full max-w-xl mx-auto py-4 sm:py-12 px-3 sm:px-6 flex flex-col justify-center">

        <div className="bg-linear-to-b from-[#1e260a] to-[#151a07] rounded-2xl sm:rounded-3xl p-4 sm:p-10 border border-[#fdcc4b]/20 shadow-2xl relative overflow-hidden">
          <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-md h-24 blur-3xl pointer-events-none rounded-full ${isCancelled ? 'bg-red-500/5' : 'bg-[#fdcc4b]/5'}`}></div>

          <div className="relative z-10">
            <CancelButton
              booking={booking as unknown as ManageBooking}
              isCancelled={isCancelled}
            />
          </div>
        </div>

        <div className="mt-6 sm:mt-auto pt-4 text-center opacity-30">
           <p className="text-[9px] font-black uppercase tracking-[0.4em]">Don Fenticas</p>
        </div>
      </div>
    </main>
  );
}
