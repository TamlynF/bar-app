import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Checks table availability for an event and updates `is_fully_booked` accordingly.
 * Only applies to events with `seating_required = true`.
 */
export async function updateFullyBookedStatus(
  supabase: SupabaseClient,
  eventId: number
) {
  // Get the event
  const { data: event } = await supabase
    .from("events")
    .select("id, seating_required")
    .eq("id", eventId)
    .single();

  if (!event || !event.seating_required) return;

  // Get all confirmed bookings for this event
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id")
    .eq("event_id", eventId)
    .eq("status", "confirmed");

  const bookingIds = bookings?.map((b) => b.id) || [];

  // Get tables currently in use
  let tablesInUse: number[] = [];
  if (bookingIds.length > 0) {
    const { data: mappings } = await supabase
      .from("booking_table_mappings")
      .select("table_id")
      .in("booking_id", bookingIds);
    tablesInUse = mappings?.map((m) => m.table_id) || [];
  }

  // Get all available tables
  const { data: allTables } = await supabase
    .from("tables")
    .select("id")
    .eq("available", true);

  const totalTables = allTables?.length || 0;
  const freeTables = allTables?.filter((t) => !tablesInUse.includes(t.id)).length || 0;

  const isFullyBooked = totalTables > 0 && freeTables === 0;

  await supabase
    .from("events")
    .update({ is_fully_booked: isFullyBooked })
    .eq("id", eventId);
}
