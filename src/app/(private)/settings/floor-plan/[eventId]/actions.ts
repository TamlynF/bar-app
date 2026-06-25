"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ChairChange = { mappingId: number; addSeat: number };

/**
 * Persist a computed floor plan to `events.floor_plan_layout` and push any
 * per-table extra-chair changes back to `booking_table_mappings.add_seat`.
 */
export async function saveFloorPlanLayoutAction(
  eventId: number,
  layout: unknown,
  chairChanges: ChairChange[] = []
) {
  const supabase = await createClient();

  if (!eventId) return { error: "Missing event id." };

  try {
    const { error: layoutError } = await supabase
      .from("events")
      .update({ floor_plan_layout: layout })
      .eq("id", eventId);
    if (layoutError) throw layoutError;

    // Update add_seat only where it actually changed.
    for (const change of chairChanges) {
      const { error } = await supabase
        .from("booking_table_mappings")
        .update({ add_seat: Math.max(0, Math.round(change.addSeat)) })
        .eq("id", change.mappingId);
      if (error) throw error;
    }

    revalidatePath(`/settings/floor-plan/${eventId}`);
    return { success: true };
  } catch (error) {
    console.error("Error saving floor plan layout:", error);
    return { error: error instanceof Error ? error.message : "Failed to save floor plan." };
  }
}
