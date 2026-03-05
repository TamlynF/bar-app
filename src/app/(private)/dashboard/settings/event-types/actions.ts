"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// --- EVENT TYPES ACTIONS ---

export async function saveEventTypeAction(formData: FormData) {
  const supabase = await createClient();
  
  const id = formData.get("id")?.toString();
  const type = formData.get("type")?.toString();
  const sub_type = formData.get("sub_type")?.toString();

  if (!type || !sub_type) {
    return { error: "Primary type and Sub-type are required." };
  }

  try {
    if (id) {
      const { error } = await supabase
        .from("event_types")
        .update({ type, sub_type })
        .eq("id", id);
        
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("event_types")
        .insert({ type, sub_type });
        
      if (error) throw error;
    }

    revalidatePath("/dashboard/settings/event-types");
    return { success: true };
  } catch (error) {
    console.error("Error saving event type:", error);
      return { error: error instanceof Error ? error.message : "Failed to save event type." };
  }
}

export async function deleteEventTypeAction(id: number) {
  const supabase = await createClient();
  
  try {
    const { error } = await supabase.from("event_types").delete().eq("id", id);
    if (error) throw error;
    
    revalidatePath("/dashboard/settings/event-types");
    return { success: true };
  } catch (error) {
    console.error("Error deleting event type:", error);
      return { error: error instanceof Error ? error.message : "Failed to delete event type." };
  }
}

// --- EVENT INFORMATION ACTIONS ---

export async function saveEventInfoAction(formData: FormData) {
  const supabase = await createClient();
  
  const id = formData.get("id")?.toString();
  const event_types_id = parseInt(formData.get("event_types_id")?.toString() || "0", 10);
  const title = formData.get("title")?.toString();
  const description = formData.get("description")?.toString() || null;
  const icon = formData.get("icon")?.toString() || null;

  if (!title || !event_types_id) {
    return { error: "Title and a linked Event Type are required." };
  }

  try {
    if (id) {
      const { error } = await supabase
        .from("event_information")
        .update({ title, description, icon }) // We don't usually change the parent ID once linked
        .eq("id", id);
        
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("event_information")
        .insert({ event_types_id, title, description, icon });
        
      if (error) throw error;
    }

    revalidatePath("/dashboard/settings/event-types");
    return { success: true };
  } catch (error) {
    console.error("Error saving event info:", error);
      return { error: error instanceof Error ? error.message : "Failed to save event information." };
  }
}

export async function deleteEventInfoAction(id: number) {
  const supabase = await createClient();
  
  try {
    const { error } = await supabase.from("event_information").delete().eq("id", id);
    if (error) throw error;
    
    revalidatePath("/dashboard/settings/event-types");
    return { success: true };
  } catch (error) {
    console.error("Error deleting event information:", error);
    return { error: error instanceof Error ? error.message : "Failed to delete event information." };
  }
}