"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { planSave, planDelete, type OrderChange, type OrderRow } from "@/lib/merchandise-order";
import type { SupabaseClient } from "@supabase/supabase-js";

async function loadOrderRows(supabase: SupabaseClient): Promise<OrderRow[]> {
  const { data, error } = await supabase
    .from("specials")
    .select("id, title, display_order, is_active");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as number,
    name: (row.title as string | null) ?? "",
    display_order: (row.display_order as number | null) ?? 0,
    is_active: row.is_active !== false,
  }));
}

async function applyChanges(supabase: SupabaseClient, changes: OrderChange[]) {
  for (const change of changes) {
    const { error } = await supabase
      .from("specials")
      .update({ display_order: change.display_order })
      .eq("id", change.id);
    if (error) throw error;
  }
}

export async function saveSpecialAction(formData: FormData) {
  const supabase = await createClient();

  const id = formData.get("id")?.toString();
  const badgesRaw = formData.get("badges")?.toString() || "";
  const badges = badgesRaw
    .split(",")
    .map((b) => b.trim().toUpperCase())
    .filter(Boolean);

  const days_of_week = Array.from(
    new Set(
      formData
        .getAll("days_of_week")
        .map((d) => parseInt(d.toString(), 10))
        .filter((n) => n >= 1 && n <= 7)
    )
  ).sort((a, b) => a - b);

  const isActive = formData.get("is_active") !== "false";
  const targetPositionRaw = formData.get("display_order")?.toString().trim() ?? "";
  const targetPosition = targetPositionRaw === "" ? null : Number(targetPositionRaw);

  const payload = {
    title: formData.get("title")?.toString() || "",
    description: formData.get("description")?.toString() || null,
    badges,
    image_url: formData.get("image_url")?.toString() || null,
    start_date: formData.get("start_date")?.toString() || null,
    end_date: formData.get("end_date")?.toString() || null,
    days_of_week,
    is_active: isActive,
  };

  if (!payload.title) {
    return { error: "Title is required." };
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

    const ordered = { ...payload, display_order: plan.position };

    if (id) {
      const { error } = await supabase
        .from("specials")
        .update({
          ...ordered,
          updated_at: new Date().toISOString(),
          updated_by: currentEmployeeId,
        })
        .eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("specials").insert({
        ...ordered,
        created_by: currentEmployeeId,
        updated_by: currentEmployeeId,
      });
      if (error) throw error;
    }

    await applyChanges(supabase, plan.changes);

    revalidatePath("/settings/specials");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error saving special:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to save special.",
    };
  }
}

export async function deleteSpecialAction(id: number) {
  const supabase = await createClient();

  try {
    const rows = await loadOrderRows(supabase);

    const { error } = await supabase.from("specials").delete().eq("id", id);
    if (error) throw error;

    await applyChanges(supabase, planDelete(rows, id));

    revalidatePath("/settings/specials");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error deleting special:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to delete special.",
    };
  }
}
