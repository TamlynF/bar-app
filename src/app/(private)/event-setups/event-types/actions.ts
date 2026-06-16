"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { isEventBehavior } from "@/lib/event-behavior";

async function currentEmployeeId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const { data: emp } = await supabase.from("employees").select("id").eq("email", user.email).maybeSingle();
  return emp?.id ?? null;
}

// --- EVENT TYPE (category) ACTIONS ---

export async function saveTypeAction(formData: FormData) {
  const supabase = await createClient();

  const id = formData.get("id")?.toString();
  const name = formData.get("name")?.toString()?.trim().toLowerCase();
  const description = formData.get("description")?.toString() || null;
  const color = formData.get("color")?.toString() || null;

  if (!name) return { error: "Category name is required." };

  const empId = await currentEmployeeId();

  try {
    if (id) {
      const { error } = await supabase
        .from("event_types")
        .update({ name, description, color, modified_by: empId, modified_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("event_types")
        .insert({ name, description, color, created_by: empId, modified_by: empId });
      if (error) throw error;
    }
    revalidatePath("/event-setups/event-types");
    return { success: true };
  } catch (error) {
    console.error("Error saving event type:", error);
    return { error: error instanceof Error ? error.message : "Failed to save category." };
  }
}

export async function deleteTypeAction(id: number) {
  const supabase = await createClient();
  try {
    const { count, error: countError } = await supabase
      .from("events")
      .select("*", { count: "exact", head: true })
      .eq("event_types_id", id);
    if (countError) throw countError;
    if (count && count > 0) {
      return { error: `Action Denied: This category is used by ${count} scheduled event(s).` };
    }

    // Remove badges of all child subtypes first (no cascade on that FK).
    const { data: subs } = await supabase.from("event_subtypes").select("id").eq("event_types_id", id);
    const subIds = (subs ?? []).map((s) => s.id);
    if (subIds.length > 0) {
      const { error: badgeError } = await supabase.from("event_subtype_badges").delete().in("event_subtypes_id", subIds);
      if (badgeError) throw badgeError;
    }

    // Deleting the type cascades its subtypes.
    const { error } = await supabase.from("event_types").delete().eq("id", id);
    if (error) throw error;

    revalidatePath("/event-setups/event-types");
    return { success: true };
  } catch (error) {
    console.error("Error deleting category:", error);
    return { error: error instanceof Error ? error.message : "Failed to delete category." };
  }
}

// --- EVENT SUBTYPE ACTIONS ---

export async function saveSubtypeAction(formData: FormData) {
  const supabase = await createClient();

  const id = formData.get("id")?.toString();
  const event_types_id = parseInt(formData.get("event_types_id")?.toString() || "0", 10);
  const name = formData.get("name")?.toString()?.trim().toLowerCase();
  const default_event_title = formData.get("default_event_title")?.toString() || null;
  const tagline = formData.get("tagline")?.toString() || null;
  const color = formData.get("color")?.toString() || null;
  const behavior = formData.get("behavior")?.toString();
  const is_bookable = formData.get("is_bookable") === "on";
  const host_required = formData.get("host_required") === "on";
  const seating_required = formData.get("seating_required") === "on";
  const payment_required = formData.get("payment_required") === "on";
  const default_payment_amount = parseFloat(formData.get("default_payment_amount")?.toString() || "0");
  const default_booking_config = JSON.parse(formData.get("default_booking_config")?.toString() || "{}");

  if (!event_types_id || !name) {
    return { error: "Category and sub-type name are required." };
  }
  if (!isEventBehavior(behavior)) {
    return { error: "A valid behaviour is required." };
  }

  const empId = await currentEmployeeId();

  const payload = {
    event_types_id,
    name,
    default_event_title,
    tagline,
    color,
    behavior,
    is_bookable,
    host_required,
    seating_required,
    payment_required,
    default_payment_amount,
    default_booking_config,
  };

  try {
    if (id) {
      const { error } = await supabase
        .from("event_subtypes")
        .update({ ...payload, modified_by: empId, modified_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("event_subtypes")
        .insert({ ...payload, created_by: empId, modified_by: empId });
      if (error) throw error;
    }
    revalidatePath("/event-setups/event-types");
    return { success: true };
  } catch (error) {
    console.error("Error saving sub-type:", error);
    return { error: error instanceof Error ? error.message : "Failed to save sub-type." };
  }
}

export async function deleteSubtypeAction(id: number) {
  const supabase = await createClient();
  try {
    const { count, error: countError } = await supabase
      .from("events")
      .select("*", { count: "exact", head: true })
      .eq("event_subtypes_id", id);
    if (countError) throw countError;
    if (count && count > 0) {
      return { error: `Action Denied: This sub-type is used by ${count} scheduled event(s).` };
    }

    const { error: badgeError } = await supabase.from("event_subtype_badges").delete().eq("event_subtypes_id", id);
    if (badgeError) throw badgeError;

    const { error } = await supabase.from("event_subtypes").delete().eq("id", id);
    if (error) throw error;

    revalidatePath("/event-setups/event-types");
    return { success: true };
  } catch (error) {
    console.error("Error deleting sub-type:", error);
    return { error: error instanceof Error ? error.message : "Failed to delete sub-type." };
  }
}

// --- BADGE (event_subtype_badges) ACTIONS ---

export async function saveBadgeAction(formData: FormData) {
  const supabase = await createClient();

  const id = formData.get("id")?.toString();
  const event_subtypes_id = parseInt(formData.get("event_subtypes_id")?.toString() || "0", 10);
  const title = formData.get("title")?.toString();
  const description = formData.get("description")?.toString() || null;
  const icon = formData.get("icon")?.toString() || null;

  if (!title || !event_subtypes_id) {
    return { error: "Title and a linked sub-type are required." };
  }

  try {
    if (id) {
      const { error } = await supabase.from("event_subtype_badges").update({ title, description, icon }).eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("event_subtype_badges").insert({ event_subtypes_id, title, description, icon });
      if (error) throw error;
    }
    revalidatePath("/event-setups/event-types");
    return { success: true };
  } catch (error) {
    console.error("Error saving badge:", error);
    return { error: error instanceof Error ? error.message : "Failed to save badge." };
  }
}

export async function deleteBadgeAction(id: number) {
  const supabase = await createClient();
  try {
    const { error } = await supabase.from("event_subtype_badges").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/event-setups/event-types");
    return { success: true };
  } catch (error) {
    console.error("Error deleting badge:", error);
    return { error: error instanceof Error ? error.message : "Failed to delete badge." };
  }
}
