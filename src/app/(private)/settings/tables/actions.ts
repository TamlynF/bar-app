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

  if (!max_capacity || max_capacity <= 0) {
    return { error: "A valid capacity is required." };
  }

  const payload = { 
    name, 
    max_capacity, 
    description,
    available 
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