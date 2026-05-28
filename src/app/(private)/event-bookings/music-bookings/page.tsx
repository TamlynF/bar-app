import React from "react";
import { createClient } from "@/lib/supabase/server";
import type { BandRequest } from "./components/band-booking-card";
import BandBookingListClient from "./components/band-booking-list-client";

export const dynamic = "force-dynamic";

export default async function MusicBookingsPage() {
  const supabase = await createClient();

  const { data: requests, error } = await supabase
    .from("band_booking_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) console.error("Music bookings fetch error:", error);

  const items = (requests ?? []) as BandRequest[];

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-black text-[#1F1F1A] uppercase tracking-tight">
          Band Applications
        </h2>
        <p className="text-xs text-[#5F624F] mt-0.5">
          Review and respond to artist bookings
        </p>
      </div>

      <BandBookingListClient initialRequests={items} />
    </div>
  );
}
