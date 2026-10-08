import React from "react";
import { createClient } from "@/lib/supabase/server";
import type { BandRequest } from "./components/band-booking-card";
import BandBookingListClient from "./components/band-booking-list-client";
import { getVideoUploadLimitBytes } from "@/lib/video-upload-limit-data";
import { siteUrl } from "@/lib/site-url";

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

  const maxVideoBytesPromise = getVideoUploadLimitBytes();
  const unreadPromise = supabase
    .from("email_messages")
    .select("band_booking_request_id")
    .eq("direction", "inbound")
    .is("read_at", null)
    .not("band_booking_request_id", "is", null);
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

  const { data: unreadRows } = await unreadPromise;
  const unreadByRequest = new Map<string, number>();
  for (const r of unreadRows ?? []) {
    const id = r.band_booking_request_id as string;
    unreadByRequest.set(id, (unreadByRequest.get(id) ?? 0) + 1);
  }

  const items = ((requests ?? []) as unknown as BandRequest[]).map((r) => ({
    ...r,
    unread_emails: unreadByRequest.get(r.id) ?? 0,
  }));
  const maxVideoBytes = await maxVideoBytesPromise;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-1.5 py-4 sm:px-3 sm:py-0 md:px-4 xl:max-w-none">
      <BandBookingListClient
        initialRequests={items}
        initialStatuses={initialStatuses}
        maxVideoBytes={maxVideoBytes}
        siteUrl={siteUrl()}
      />
    </div>
  );
}
