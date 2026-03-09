"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// --- EVENT TYPES ACTIONS ---

export async function saveEventTypeAction(formData: FormData) {
  const supabase = await createClient();
  
  const id = formData.get("id")?.toString();
  const type = formData.get("type")?.toString()?.toLowerCase();
  const sub_type = formData.get("sub_type")?.toString()?.toLowerCase();

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

export async function renameEventTypeGroupAction(oldType: string, newType: string) {
  const supabase = await createClient();
  
  try {
    const { error } = await supabase
      .from("event_types")
      .update({ type: newType.toLowerCase() })
      .ilike("type", oldType);

    if (error) throw error;

    revalidatePath("/dashboard/settings/event-types");
    return { success: true };
  } catch (error) {
    console.error("Error renaming group:", error);
    return { error: error instanceof Error ? error.message : "Failed to rename event type group." };
  }
}

export async function deleteEventTypeGroupAction(type: string) {
  const supabase = await createClient();
  const typeLower = type.toLowerCase();

  try {
    // 1. Get all IDs for this primary type
    const { data: types, error: fetchError } = await supabase
      .from("event_types")
      .select("id")
      .ilike("type", typeLower);

    if (fetchError) throw fetchError;
    if (!types || types.length === 0) return { success: true };

    const ids = types.map(t => t.id);

    // 2. Check for scheduled events using ANY of these types
    const { count, error: countError } = await supabase
      .from("events")
      .select("*", { count: 'exact', head: true })
      .in("event_types_id", ids);

    if (countError) throw countError;
    
    if (count && count > 0) {
      return { 
        error: `Action Denied: This group contains types currently used by ${count} scheduled event(s).` 
      };
    }

    const { error: infoError } = await supabase
      .from("event_information")
      .delete()
      .in("event_types_id", ids);

    if (infoError) throw infoError;

    // 4. Delete the event types themselves
    const { error } = await supabase
      .from("event_types")
      .delete()
      .in("id", ids);

    if (error) throw error;
    
    revalidatePath("/dashboard/settings/event-types");
    return { success: true };
  } catch (error) {
    console.error("Error deleting event type group:", error);
    return { error: error instanceof Error ? error.message : "Failed to delete the event group." };
  }
}

export async function deleteEventTypeAction(id: number) {
  console.log("Attempting to delete event type with ID:", id);
  const supabase = await createClient();
  
  try {
    const { count, error: countError } = await supabase
      .from("events")
      .select("*", { count: 'exact', head: true })
      .eq("event_types_id", id);

    if (countError) throw countError;
    
    if (count && count > 0) {
      return { 
        error: `Action Denied: This sub-type is currently used by ${count} scheduled event(s). You must delete or reassign those events before removing this type.` 
      };
    }

    const { error: infoError } = await supabase
      .from("event_information")
      .delete()
      .eq("event_types_id", id);

    if (infoError) throw infoError;

    const { error } = await supabase
      .from("event_types")
      .delete()
      .eq("id", id);

    if (error) throw error;
    
    revalidatePath("/dashboard/settings/event-types");
    return { success: true };
  } catch (error) {
    console.error("Error deleting event type:", error);
    return { error: error instanceof Error ? error.message : "An internal error occurred while deleting." };
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
        .update({ title, description, icon })
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
