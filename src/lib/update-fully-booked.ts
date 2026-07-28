import { SupabaseClient } from "@supabase/supabase-js";
import { getFreeTablesForEvent } from "@/lib/table-allocation";

export function sumConfirmedGroupSizes(bookings: { group_size: number | null }[]): number {
  return bookings.reduce((total, b) => total + (b.group_size ?? 0), 0);
}

async function hasNoFreeTables(supabase: SupabaseClient, eventId: number): Promise<boolean> {
  const [{ count: totalTables }, freeTables] = await Promise.all([
    supabase.from("tables").select("*", { count: "exact", head: true }).eq("available", true),
    getFreeTablesForEvent(supabase, eventId),
  ]);

  return (totalTables ?? 0) > 0 && freeTables.length === 0;
}

async function getVenueMaxCapacity(supabase: SupabaseClient): Promise<number | null> {
  const { data } = await supabase
    .from("company_information")
    .select("max_capacity")
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  const maxCapacity = data?.max_capacity as number | null | undefined;
  return typeof maxCapacity === "number" && maxCapacity > 0 ? maxCapacity : null;
}

async function hasReachedVenueCapacity(
  supabase: SupabaseClient,
  eventId: number,
  maxCapacity: number
): Promise<boolean> {
  const { data } = await supabase
    .from("bookings")
    .select("group_size")
    .eq("event_id", eventId)
    .eq("status", "confirmed");

  return sumConfirmedGroupSizes((data ?? []) as { group_size: number | null }[]) >= maxCapacity;
}

export async function updateFullyBookedStatus(
  supabase: SupabaseClient,
  eventId: number
) {
  const { data: event } = await supabase
    .from("events")
    .select("id, seating_required")
    .eq("id", eventId)
    .single();

  if (!event) return;

  let isFullyBooked: boolean;

  if (event.seating_required) {
    isFullyBooked = await hasNoFreeTables(supabase, eventId);
  } else {
    const maxCapacity = await getVenueMaxCapacity(supabase);
    if (maxCapacity === null) return;
    isFullyBooked = await hasReachedVenueCapacity(supabase, eventId, maxCapacity);
  }

  await supabase
    .from("events")
    .update({ is_fully_booked: isFullyBooked })
    .eq("id", eventId);
}
