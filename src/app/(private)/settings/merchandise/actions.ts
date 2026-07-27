"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  planSave,
  planDelete,
  type OrderChange,
  type OrderRow,
} from "@/lib/merchandise-order";
import type { SupabaseClient } from "@supabase/supabase-js";

async function loadOrderRows(supabase: SupabaseClient): Promise<OrderRow[]> {
  const { data, error } = await supabase
    .from("merchandise")
    .select("id, name, display_order, is_active");
  if (error) throw error;
  return (data ?? []) as OrderRow[];
}

async function applyChanges(supabase: SupabaseClient, changes: OrderChange[]) {
  for (const change of changes) {
    const { error } = await supabase
      .from("merchandise")
      .update({ display_order: change.display_order })
      .eq("id", change.id);
    if (error) throw error;
  }
}

export async function saveMerchandiseAction(formData: FormData) {
  const supabase = await createClient();

  const id = formData.get("id")?.toString();

  const priceRaw = formData.get("price")?.toString().trim() ?? "";
  const price = priceRaw === "" ? null : Number(priceRaw);

  const name = formData.get("name")?.toString().trim() || "";
  const isActive = formData.get("is_active") !== "false";
  const targetPositionRaw = formData.get("display_order")?.toString().trim() ?? "";
  const targetPosition =
    targetPositionRaw === "" ? null : Number(targetPositionRaw);

  if (!name) {
    return { error: "Name is required." };
  }

  if (price !== null && (!Number.isFinite(price) || price < 0)) {
    return { error: "Price must be a positive number." };
  }

  let currentEmployeeId: number | null = null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.email) {
    const { data: emp } = await supabase
      .from("employees")
      .select("id")
      .eq("email", user.email)
      .maybeSingle();
    if (emp) currentEmployeeId = emp.id;
  }

  try {
    const rows = await loadOrderRows(supabase);
    const plan = planSave(rows, {
      id: id ? Number(id) : null,
      isActive,
      targetPosition,
    });

    const payload = {
      name,
      description: formData.get("description")?.toString() || null,
      image_url: formData.get("image_url")?.toString() || null,
      price,
      is_active: isActive,
      display_order: plan.position,
    };

    if (id) {
      const { error } = await supabase
        .from("merchandise")
        .update({
          ...payload,
          updated_at: new Date().toISOString(),
          updated_by: currentEmployeeId,
        })
        .eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("merchandise").insert({
        ...payload,
        created_by: currentEmployeeId,
        updated_by: currentEmployeeId,
      });
      if (error) throw error;
    }

    await applyChanges(supabase, plan.changes);

    revalidatePath("/settings/merchandise");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error saving merchandise:", error);
    return {
      error:
        error instanceof Error ? error.message : "Failed to save merchandise.",
    };
  }
}

export async function deleteMerchandiseAction(id: number) {
  const supabase = await createClient();

  try {
    const rows = await loadOrderRows(supabase);

    const { error } = await supabase.from("merchandise").delete().eq("id", id);
    if (error) throw error;

    await applyChanges(supabase, planDelete(rows, id));

    revalidatePath("/settings/merchandise");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error deleting merchandise:", error);
    return {
      error:
        error instanceof Error ? error.message : "Failed to delete merchandise.",
    };
  }
}
