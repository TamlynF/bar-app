"use server";

import { createClient } from "@/lib/supabase/server";
import { getFreeTablesForEvent, seatingApplies, type SeatingEvent } from "@/lib/table-allocation";
import { hasVenueSpaceFor } from "@/lib/update-fully-booked";

export async function checkSeatingAvailability(
  eventId: number | string,
  groupSize: number,
  excludeBookingId?: string | number
): Promise<{ seatingRequired: boolean; hasSpace: boolean }> {
  if (!eventId || !Number.isFinite(groupSize) || groupSize < 1) {
    return { seatingRequired: false, hasSpace: true };
  }

  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, seating_required, is_bookable")
    .eq("id", eventId)
    .maybeSingle();

  if (!event) {
    return { seatingRequired: false, hasSpace: true };
  }

  if (!seatingApplies(event as SeatingEvent)) {
    return {
      seatingRequired: false,
      hasSpace: await hasVenueSpaceFor(supabase, eventId, groupSize, excludeBookingId),
    };
  }

  const freeTables = await getFreeTablesForEvent(supabase, Number(eventId), {
    groupSize,
    excludeBookingId,
  });

  return { seatingRequired: true, hasSpace: freeTables.length > 0 };
}
