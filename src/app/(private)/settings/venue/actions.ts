"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getCurrentEmployeeId } from "@/lib/current-employee";
import type { VenueGeometry } from "@/lib/floor-plan/types";

export async function saveVenueLayoutAction(
  companyId: number,
  geometry: VenueGeometry
) {
  const supabase = await createClient();

  if (!companyId) {
    return { error: "No company record found to save against." };
  }

  if (geometry.room_outline && geometry.room_outline.points.length < 3) {
    return { error: "The room outline needs at least 3 points." };
  }

  const currentEmployeeId = await getCurrentEmployeeId(supabase);

  try {
    const { error } = await supabase
      .from("company_information")
      .update({
        room_outline: geometry.room_outline,
        obstacles: geometry.obstacles ?? [],
        fixtures: geometry.fixtures ?? [],
        features: geometry.features ?? [],
        updated_at: new Date().toISOString(),
        updated_by: currentEmployeeId,
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
