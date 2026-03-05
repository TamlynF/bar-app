"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function saveContactAction(formData: FormData) {
  const supabase = await createClient();
  
  const id = formData.get("id")?.toString();
  
  // Extracting data matching the schema
  const payload = {
    full_name: formData.get("full_name")?.toString() || "",
    email: formData.get("email")?.toString() || "",
    country_code: formData.get("country_code")?.toString() || null,
    phone_no: formData.get("phone_no")?.toString() || null,
    birthday: formData.get("birthday")?.toString() || null,
  };

  if (!payload.full_name || !payload.email) {
    return { error: "Full Name and Email are required." };
  }

  try {
    if (id) {
      // Update existing contact
      const { error } = await supabase.from("contacts").update(payload).eq("id", id);
      
      // Catch unique email violations nicely
      if (error?.code === '23505') {
        throw new Error("A customer with this email address already exists.");
      } else if (error) {
        throw error;
      }
    } else {
      // Insert new contact
      const { error } = await supabase.from("contacts").insert(payload);
      
      // Catch unique email violations nicely
      if (error?.code === '23505') {
        throw new Error("A customer with this email address already exists.");
      } else if (error) {
        throw error;
      }
    }

    revalidatePath("/dashboard/settings/customers"); // Adjust to your actual route
    return { success: true };
  } catch (error) {
    console.error("Error saving contact:", error);
    return { error: error instanceof Error ? error.message : "Failed to save contacts." };
  }
}

export async function deleteContactAction(id: number) {
  const supabase = await createClient();
  
  try {
    const { error } = await supabase.from("contacts").delete().eq("id", id);
    if (error) throw error;
    
    revalidatePath("/dashboard/settings/customers");
    return { success: true };
  } catch (error) {
    console.error("Error deleting contact:", error);
      return { error: error instanceof Error ? error.message : "Failed to delete contacts." };
  }
}