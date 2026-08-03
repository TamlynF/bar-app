"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getCurrentEmployeeId } from "@/lib/current-employee";
import {
  planSave,
  planDelete,
  type OrderChange,
  type OrderRow,
} from "@/lib/merchandise-order";

type ServerClient = Awaited<ReturnType<typeof createClient>>;
type OrderedTable = "menu_categories" | "menu_items";

async function loadCategoryRows(supabase: ServerClient): Promise<OrderRow[]> {
  const { data, error } = await supabase
    .from("menu_categories")
    .select("id, name, display_order, is_active");
  if (error) throw error;
  return (data ?? []) as OrderRow[];
}

async function loadItemRows(
  supabase: ServerClient,
  categoryId: number
): Promise<OrderRow[]> {
  const { data, error } = await supabase
    .from("menu_items")
    .select("id, name, display_order, is_active")
    .eq("category_id", categoryId);
  if (error) throw error;
  return (data ?? []) as OrderRow[];
}

async function applyChanges(
  supabase: ServerClient,
  table: OrderedTable,
  changes: OrderChange[]
) {
  for (const change of changes) {
    const { error } = await supabase
      .from(table)
      .update({ display_order: change.display_order })
      .eq("id", change.id);
    if (error) throw error;
  }
}

function readTargetPosition(formData: FormData): number | null {
  const raw = formData.get("display_order")?.toString().trim() ?? "";
  return raw === "" ? null : Number(raw);
}

export async function saveCategoryAction(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id")?.toString();

  const name = formData.get("name")?.toString().trim() || "";
  const isActive = formData.get("is_active") !== "false";

  if (!name) return { error: "Category name is required." };

  const currentEmployeeId = await getCurrentEmployeeId(supabase);
  const now = new Date().toISOString();

  try {
    const rows = await loadCategoryRows(supabase);
    const plan = planSave(rows, {
      id: id ? Number(id) : null,
      isActive,
      targetPosition: readTargetPosition(formData),
    });

    const payload = {
      name,
      note: formData.get("note")?.toString() || null,
      display_order: plan.position,
      is_active: isActive,
    };

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

    await applyChanges(supabase, "menu_categories", plan.changes);

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
    const rows = await loadCategoryRows(supabase);

    const { error } = await supabase.from("menu_categories").delete().eq("id", id);
    if (error) throw error;

    await applyChanges(supabase, "menu_categories", planDelete(rows, id));

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

  const categoryId = parseInt(formData.get("category_id")?.toString() || "0", 10);
  const name = formData.get("name")?.toString().trim() || "";
  const price = formData.get("price")?.toString().trim() || "";
  const isActive = formData.get("is_active") !== "false";

  if (!name || !price) return { error: "Name and price are required." };
  if (!categoryId) return { error: "Category is required." };

  const currentEmployeeId = await getCurrentEmployeeId(supabase);
  const now = new Date().toISOString();

  try {
    const rows = await loadItemRows(supabase, categoryId);
    const plan = planSave(rows, {
      id: id ? Number(id) : null,
      isActive,
      targetPosition: readTargetPosition(formData),
    });

    const payload = {
      category_id: categoryId,
      name,
      price,
      display_order: plan.position,
      is_active: isActive,
    };

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

    await applyChanges(supabase, "menu_items", plan.changes);

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
    const { data: item, error: lookupError } = await supabase
      .from("menu_items")
      .select("category_id")
      .eq("id", id)
      .maybeSingle();
    if (lookupError) throw lookupError;

    const rows = item ? await loadItemRows(supabase, item.category_id) : [];

    const { error } = await supabase.from("menu_items").delete().eq("id", id);
    if (error) throw error;

    await applyChanges(supabase, "menu_items", planDelete(rows, id));

    revalidatePath("/settings/menu");
    revalidatePath("/menu");
    return { success: true };
  } catch (error) {
    console.error("Error deleting item:", error);
    return { error: error instanceof Error ? error.message : "Failed to delete item." };
  }
}
