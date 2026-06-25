"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function saveTableAction(formData: FormData) {
  const supabase = await createClient();
  
  const id = formData.get("id")?.toString();
  const name = formData.get("name")?.toString();
  const max_capacity = parseInt(formData.get("capacity")?.toString() || "0", 10);
  const description = formData.get("description")?.toString() || null;
  const available = formData.get("available") === "on"; // Checkbox value

  const shape = formData.get("shape")?.toString() === "rect" ? "rect" : "round";
  const parseDim = (key: string) => {
    const raw = formData.get(key)?.toString().trim();
    if (!raw) return null;
    const n = parseFloat(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  // Keep dimensions consistent with the chosen shape (clear the unused ones).
  const diameter = shape === "round" ? parseDim("diameter") : null;
  const width = shape === "rect" ? parseDim("width") : null;
  const length = shape === "rect" ? parseDim("length") : null;

  // Chair arrangement (rect only). 'auto' (or round) stores null.
  const parseCount = (key: string) => {
    const n = parseInt(formData.get(key)?.toString() || "", 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  const chairMode = formData.get("chair_mode")?.toString();
  let chair_layout: { mode: "sides" | "bench"; perSide: number; ends?: number } | null = null;
  if (shape === "rect" && (chairMode === "sides" || chairMode === "bench")) {
    const perSide = parseCount("chair_per_side");
    chair_layout =
      chairMode === "bench"
        ? { mode: "bench", perSide }
        : { mode: "sides", perSide, ends: parseCount("chair_ends") };
  }

  if (!max_capacity || max_capacity <= 0) {
    return { error: "A valid capacity is required." };
  }

  const payload = {
    name,
    max_capacity,
    description,
    available,
    shape,
    diameter,
    width,
    length,
    chair_layout,
  };

  try {
    if (id) {
      // Update existing table
      const { error } = await supabase
        .from("tables")
        .update(payload)
        .eq("id", id);
        
      if (error) throw error;
    } else {
      // Insert new table
      const { error } = await supabase
        .from("tables")
        .insert(payload);
        
      if (error) throw error;
    }

    // Refresh the page data
    revalidatePath("/settings/tables");
    return { success: true };
  } catch (error) {
    console.error("Error saving table:", error);
    return { error: error instanceof Error ? error.message : "Failed to save table." };
  }
}

export async function deleteTableAction(id: number) {
  const supabase = await createClient();
  
  try {
    // Check for active bookings before deleting
    const { count, error: countError } = await supabase
      .from("booking_table_mappings")
      .select("*", { count: 'exact', head: true })
      .eq("table_id", id);

    if (countError) throw countError;

    if (count && count > 0) {
      return { error: "Cannot delete this table as it has associated booking history. Try marking it as 'unavailable' instead." };
    }

    const { error } = await supabase.from("tables").delete().eq("id", id);
    if (error) throw error;
    
    revalidatePath("/settings/tables");
    return { success: true };
  } catch (error) {
    console.error("Error deleting table:", error);
    return { error: error instanceof Error ? error.message : "Failed to delete table." };
  }
}