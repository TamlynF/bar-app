"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function saveEventAction(formData: FormData) {
  const supabase = await createClient();
  
  const id = formData.get("id")?.toString();
  
  // Extracting data matching the schema
  const payload = {
    title: formData.get("title")?.toString() || "",
    description: formData.get("description")?.toString() || "",
    date: formData.get("date")?.toString(),
    start_time: formData.get("start_time")?.toString() || null,
    end_time: formData.get("end_time")?.toString() || null,
    payment_amount: parseFloat(formData.get("payment_amount")?.toString() || "0"),
    event_types_id: parseInt(formData.get("event_types_id")?.toString() || "0", 10),
    host_employee_id: formData.get("host_employee_id") ? parseInt(formData.get("host_employee_id")?.toString() as string, 10) : null,
    seating_required: formData.get("seating_required") === "on", // checkbox returns "on" if checked
  };

  try {
    if (id) {
      const { error } = await supabase.from("events").update(payload).eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("events").insert(payload);
      if (error) throw error;
    }

    revalidatePath("/events"); // Adjust to your actual route
    return { success: true };
  } catch (error) {
    console.error("Error saving event:", error);
    return { error: error instanceof Error ? error.message : "Failed to save event." };
  }
}

export async function deleteEventAction(id: number) {
  const supabase = await createClient();
  try {
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/events");
    return { success: true };
  } catch (error) {
    console.error("Error deleting event:", error);
    return { error: error instanceof Error ? error.message : "Failed to delete event." };
  }
}