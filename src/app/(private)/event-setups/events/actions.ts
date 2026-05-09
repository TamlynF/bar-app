"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function saveEventAction(formData: FormData) {
  const supabase = await createClient();

  const id = formData.get("id")?.toString();

  const payload = {
    title: formData.get("title")?.toString() || "",
    description: formData.get("description")?.toString() || "",
    date: formData.get("date")?.toString(),
    start_time: formData.get("start_time")?.toString() || null,
    end_time: formData.get("end_time")?.toString() || null,
    payment_amount: parseFloat(formData.get("payment_amount")?.toString() || "0"),
    event_types_id: parseInt(formData.get("event_types_id")?.toString() || "0", 10),
    host_employee_id: formData.get("host_employee_id") ? parseInt(formData.get("host_employee_id") as string, 10) : null,
    seating_required: formData.get("seating_required") === "on",
    is_active: formData.get("is_active") === "on",
    is_fully_booked: formData.get("is_fully_booked") === "on",
    group_name: formData.get("group_name")?.toString() || null,
    booking_id: formData.get("booking_id") ? parseInt(formData.get("booking_id") as string, 10) : null,
  };

  // Resolve current logged-in user to an employee id
  let currentEmployeeId: number | null = null;
  const { data: { user } } = await supabase.auth.getUser();
  console.log("Current user:", user);
  if (user?.email) {
    const { data: emp } = await supabase.from("employees").select("id").eq("email", user.email).maybeSingle();
    console.log("Resolved employee:", emp);
    if (emp) currentEmployeeId = emp.id;
  }

  try {
    if (id) {
      const { error } = await supabase.from("events").update({
        ...payload,
        updated_by: currentEmployeeId,
        updated_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("events").insert({
        ...payload,
        created_by: currentEmployeeId,
        updated_by: currentEmployeeId,
      });
      if (error) throw error;
    }

    revalidatePath("/event-setups");
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
    revalidatePath("/event-setups");
    return { success: true };
  } catch (error) {
    console.error("Error deleting event:", error);
    return { error: error instanceof Error ? error.message : "Failed to delete event." };
  }
}