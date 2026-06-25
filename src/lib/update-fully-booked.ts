import { SupabaseClient } from "@supabase/supabase-js";
import { getFreeTablesForEvent } from "@/lib/table-allocation";

/**
 * Checks table availability for an event and updates `is_fully_booked` accordingly.
 * Only applies to events with `seating_required = true`.
 *
 * Uses the shared module's `getFreeTablesForEvent` so "taken" is computed from
 * `booking_table_mappings.event_id` (booking rows only) — the same source of
 * truth as the allocation logic, keeping this flag consistent with it.
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

  const [{ count: totalTables }, freeTables] = await Promise.all([
    supabase.from("tables").select("*", { count: "exact", head: true }).eq("available", true),
    getFreeTablesForEvent(supabase, eventId),
  ]);

  const isFullyBooked = (totalTables ?? 0) > 0 && freeTables.length === 0;

  await supabase
    .from("events")
    .update({ is_fully_booked: isFullyBooked })
    .eq("id", eventId);
}
