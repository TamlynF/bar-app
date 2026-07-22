"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ChairChange = { mappingId: number; addSeat: number };

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

export async function addEventTableAction(eventId: number, tableId: number) {
  const supabase = await createClient();
  if (!eventId || !tableId) return { error: "Missing event or table." };

  try {
    const { data: existing } = await supabase
      .from("booking_table_mappings")
      .select("id")
      .eq("event_id", eventId)
      .eq("table_id", tableId)
      .limit(1);
    if (existing && existing.length > 0) {
      return { error: "That table is already on this event." };
    }

    const { data: inserted, error } = await supabase
      .from("booking_table_mappings")
      .insert({ event_id: eventId, table_id: tableId, booking_id: null, add_seat: 0 })
      .select("id")
      .single();
    if (error) throw error;

    revalidatePath(`/settings/floor-plan/${eventId}`);
    return { success: true, mappingId: inserted?.id as number | undefined };
  } catch (error) {
    console.error("Error adding table to event:", error);
    return { error: error instanceof Error ? error.message : "Failed to add table." };
  }
}

export async function addEventTablesAction(eventId: number, tableIds: number[]) {
  const supabase = await createClient();
  if (!eventId || tableIds.length === 0) return { error: "Nothing to add." };

  try {
    const { data: existing } = await supabase
      .from("booking_table_mappings")
      .select("table_id")
      .eq("event_id", eventId);
    const used = new Set((existing ?? []).map((r) => r.table_id));
    const rows = tableIds
      .filter((tid) => !used.has(tid))
      .map((tid) => ({ event_id: eventId, table_id: tid, booking_id: null, add_seat: 0 }));
    if (rows.length === 0) return { success: true, added: 0 };

    const { error } = await supabase.from("booking_table_mappings").insert(rows);
    if (error) throw error;

    revalidatePath(`/settings/floor-plan/${eventId}`);
    return { success: true, added: rows.length };
  } catch (error) {
    console.error("Error adding tables to event:", error);
    return { error: error instanceof Error ? error.message : "Failed to add tables." };
  }
}

export async function removeEventTableAction(eventId: number, mappingId: number) {
  const supabase = await createClient();
  if (!mappingId) return { error: "Missing table." };

  try {
    const { error } = await supabase
      .from("booking_table_mappings")
      .delete()
      .eq("id", mappingId)
      .is("booking_id", null);
    if (error) throw error;

    revalidatePath(`/settings/floor-plan/${eventId}`);
    return { success: true };
  } catch (error) {
    console.error("Error removing table from event:", error);
    return { error: error instanceof Error ? error.message : "Failed to remove table." };
  }
}
