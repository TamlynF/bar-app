"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function saveTableAction(formData: FormData) {
  const supabase = await createClient();
  
  const id = formData.get("id")?.toString();
  const name = formData.get("name")?.toString();
  const max_capacity = parseInt(formData.get("capacity")?.toString() || "0", 10);

  if (!max_capacity || max_capacity <= 0) {
    return { error: "A valid capacity is required." };
  }

  try {
    if (id) {
      // Update existing table
      const { error } = await supabase
        .from("tables")
        .update({ name, max_capacity })
        .eq("id", id);
        
      if (error) throw error;
    } else {
      // Insert new table
      const { error } = await supabase
        .from("tables")
        .insert({ name, max_capacity });
        
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
    const { error } = await supabase.from("tables").delete().eq("id", id);
    if (error) throw error;
    
    revalidatePath("/settings/tables");
    return { success: true };
  } catch (error) {
    console.error("Error deleting table:", error);
    return { error: error instanceof Error ? error.message : "Failed to delete table." };
  }
}