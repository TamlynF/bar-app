import React from "react";
import { createClient } from "@/lib/supabase/server";
import type { BandRequest } from "./components/band-booking-card";
import BandBookingListClient from "./components/band-booking-list-client";

export const dynamic = "force-dynamic";

export default async function MusicBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const initialStatuses = status
    ? status.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
    : [];
  const supabase = await createClient();

  const { data: requests, error } = await supabase
    .from("band_booking_requests")
    .select(
      "*, updated_by_employee:employees!updated_by(full_name)," +
        " linked_event:events!band_booking_requests_event_id_fkey(is_active, date, start_time, end_time)," +
        " band_notes_list:band_booking_notes(id, body, created_at, author:employees!band_booking_notes_created_by_fkey(full_name))"
    )
    .order("created_at", { ascending: false })
    .order("created_at", { referencedTable: "band_booking_notes", ascending: true });

  if (error) console.error("Music bookings fetch error:", error);

  const items = (requests ?? []) as unknown as BandRequest[];

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-1.5 py-4 sm:px-3 sm:py-0 md:px-4 xl:max-w-none">
      <BandBookingListClient initialRequests={items} initialStatuses={initialStatuses} />
    </div>
  );
}
