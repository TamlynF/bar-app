"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function saveEmployeeAction(formData: FormData) {
  const supabase = await createClient();
  
  const id = formData.get("id")?.toString();
  
  // Extracting data matching the schema
  const payload = {
    full_name: formData.get("full_name")?.toString() || "",
    email: formData.get("email")?.toString() || "",
    role: formData.get("role")?.toString() || null,
    status: formData.get("status")?.toString() || "",
    start_date: formData.get("start_date")?.toString() || new Date().toISOString().split('T')[0],
    end_date: formData.get("end_date")?.toString() || null,
    country_code: formData.get("country_code")?.toString() || null,
    phone_no: formData.get("phone_no")?.toString() || null,
    birthday: formData.get("birthday")?.toString() || null,
    is_skeleton_staff: formData.get("is_skeleton_staff") === "on",
  };

  if (!payload.full_name || !payload.email || !payload.start_date) {
    return { error: "Full Name, Email, and Start Date are required." };
  }

  try {
    if (id) {
      // Update existing employee
      const { error } = await supabase.from("employees").update({
        ...payload,
        modified_at: new Date().toISOString(),
        // Note: You can add `modified_by_employee_id` here if you have the auth session context
      }).eq("id", id);
      
      // Catch unique email violations nicely
      if (error?.code === '23505') {
        throw new Error("An employee with this email address already exists.");
      } else if (error) {
        throw error;
      }
    } else {
      // Insert new employee
      const { error } = await supabase.from("employees").insert(payload);
      
      // Catch unique email violations nicely
      if (error?.code === '23505') {
        throw new Error("An employee with this email address already exists.");
      } else if (error) {
        throw error;
      }
    }

    revalidatePath("/settings/system-users"); // Adjust to your actual route
    return { success: true };
  } catch (error) {
    console.error("Error saving employee:", error);
      return { error: error instanceof Error ? error.message : "Failed to save employee." };
      
  }
}

export async function deleteEmployeeAction(id: number) {
  const supabase = await createClient();
  
  try {
    const { error } = await supabase.from("employees").delete().eq("id", id);
    if (error) throw error;
    
    revalidatePath("/settings/system-users");
    return { success: true };
  } catch (error) {
    console.error("Error deleting employee:", error);
    // If a foreign key restriction occurs (e.g., they hosted an event or modified a record)
    //if (error?.code === '23503') {
    //  return { error: "Cannot delete this employee because they are linked to existing events or records." };
    //}
      return { error: error instanceof Error ? error.message : "Failed to delete employee." };
  }
}