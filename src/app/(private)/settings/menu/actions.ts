"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getCurrentEmployeeId } from "@/lib/current-employee";


export async function saveCategoryAction(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id")?.toString();

  const payload = {
    name: formData.get("name")?.toString() || "",
    note: formData.get("note")?.toString() || null,
    display_order: parseInt(formData.get("display_order")?.toString() || "0", 10),
    is_active: formData.get("is_active") !== "false",
  };

  if (!payload.name) return { error: "Category name is required." };

  const currentEmployeeId = await getCurrentEmployeeId(supabase);
  const now = new Date().toISOString();

  try {
    if (id) {
      const { error } = await supabase
        .from("menu_categories")
        .update({ ...payload, updated_at: now, updated_by: currentEmployeeId })
        .eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("menu_categories").insert({
        ...payload,
        created_at: now,
        updated_at: now,
        created_by: currentEmployeeId,
        updated_by: currentEmployeeId,
      });
      if (error) throw error;
    }
    revalidatePath("/settings/menu");
    revalidatePath("/menu");
    return { success: true };
  } catch (error) {
    console.error("Error saving category:", error);
    return { error: error instanceof Error ? error.message : "Failed to save category." };
  }
}

export async function deleteCategoryAction(id: number) {
  const supabase = await createClient();
  try {
    const { error } = await supabase.from("menu_categories").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/settings/menu");
    revalidatePath("/menu");
    return { success: true };
  } catch (error) {
    console.error("Error deleting category:", error);
    return { error: error instanceof Error ? error.message : "Failed to delete category." };
  }
}


export async function saveItemAction(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id")?.toString();

  const payload = {
    category_id: parseInt(formData.get("category_id")?.toString() || "0", 10),
    name: formData.get("name")?.toString() || "",
    price: formData.get("price")?.toString() || "",
    display_order: parseInt(formData.get("display_order")?.toString() || "0", 10),
    is_active: formData.get("is_active") !== "false",
  };

  if (!payload.name || !payload.price) return { error: "Name and price are required." };
  if (!payload.category_id) return { error: "Category is required." };

  const currentEmployeeId = await getCurrentEmployeeId(supabase);
  const now = new Date().toISOString();

  try {
    if (id) {
      const { error } = await supabase
        .from("menu_items")
        .update({ ...payload, updated_at: now, updated_by: currentEmployeeId })
        .eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("menu_items").insert({
        ...payload,
        created_at: now,
        updated_at: now,
        created_by: currentEmployeeId,
        updated_by: currentEmployeeId,
      });
      if (error) throw error;
    }
    revalidatePath("/settings/menu");
    revalidatePath("/menu");
    return { success: true };
  } catch (error) {
    console.error("Error saving item:", error);
    return { error: error instanceof Error ? error.message : "Failed to save item." };
  }
}

export async function deleteItemAction(id: number) {
  const supabase = await createClient();
  try {
    const { error } = await supabase.from("menu_items").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/settings/menu");
    revalidatePath("/menu");
    return { success: true };
  } catch (error) {
    console.error("Error deleting item:", error);
    return { error: error instanceof Error ? error.message : "Failed to delete item." };
  }
}
