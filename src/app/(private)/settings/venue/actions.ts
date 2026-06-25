"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { VenueGeometry } from "@/lib/floor-plan/types";

export async function saveVenueLayoutAction(
  companyId: number,
  geometry: VenueGeometry
) {
  const supabase = await createClient();

  if (!companyId) {
    return { error: "No company record found to save against." };
  }

  // Light server-side validation — the editor enforces most of this, but never
  // trust the client. A room is optional (can be saved empty), but if present it
  // needs at least a triangle.
  if (geometry.room_outline && geometry.room_outline.points.length < 3) {
    return { error: "The room outline needs at least 3 points." };
  }

  try {
    const { error } = await supabase
      .from("company_information")
      .update({
        room_outline: geometry.room_outline,
        obstacles: geometry.obstacles ?? [],
        fixtures: geometry.fixtures ?? [],
        features: geometry.features ?? [],
      })
      .eq("id", companyId);

    if (error) throw error;

    revalidatePath("/settings/venue");
    return { success: true };
  } catch (error) {
    console.error("Error saving venue layout:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to save venue layout.",
    };
  }
}
