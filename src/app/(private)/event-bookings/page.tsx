export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { buildAdminBookingGroups, partitionBookingGroups, type AdminBookingGroupEvent } from "@/lib/admin-booking-groups";
import BookingsHubClient from "./bookings-hub-client";

export default async function EventsHubPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: bookableEvents } = await supabase
    .from("events")
    .select("id, title, date, booking_card_title, booking_card_icon, event_types!inner(name, title, color, booking_grouping, booking_card_title, booking_card_icon), event_subtypes(name, title, color, behavior, booking_card_title, booking_card_icon)")
    .eq("is_active", true)
    .eq("is_bookable", true)
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(200);

  const allGroups = buildAdminBookingGroups((bookableEvents ?? []) as AdminBookingGroupEvent[])
    .sort((a, b) => a.label.localeCompare(b.label));
  const { guest: guestGroups } = partitionBookingGroups(allGroups);

  return <BookingsHubClient groups={guestGroups} />;
}
