import { SupabaseClient } from "@supabase/supabase-js";
import { getFreeTablesForEvent } from "@/lib/table-allocation";

export async function updateFullyBookedStatus(
  supabase: SupabaseClient,
  eventId: number
) {
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
