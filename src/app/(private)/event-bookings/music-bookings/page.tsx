import React from "react";
import { createClient } from "@/lib/supabase/server";
import type { BandRequest } from "./components/band-booking-card";
import BandBookingListClient from "./components/band-booking-list-client";

export const dynamic = "force-dynamic";

export default async function MusicBookingsPage() {
  const supabase = await createClient();

  const { data: requests, error } = await supabase
    .from("band_booking_requests")
    .select(
      "*, updated_by_employee:employees!updated_by(full_name), linked_event:events!band_booking_requests_event_id_fkey(is_active)"
    )
    .order("created_at", { ascending: false });

  if (error) console.error("Music bookings fetch error:", error);

  const items = (requests ?? []) as unknown as BandRequest[];

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-4 sm:py-0 md:px-8">
      <BandBookingListClient initialRequests={items} />
    </div>
  );
}
