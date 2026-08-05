"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getCurrentEmployeeId } from "@/lib/current-employee";
import { SERVES, type Serve } from "@/lib/menu-price";
import { planSave, planDelete, type OrderChange, type OrderRow } from "@/lib/merchandise-order";
import type { SupabaseClient } from "@supabase/supabase-js";

async function loadOrderRows(supabase: SupabaseClient): Promise<OrderRow[]> {
  const { data, error } = await supabase
    .from("price_benchmarks")
    .select("id, label, display_order, is_active");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as number,
    name: (row.label as string | null) ?? "",
    display_order: (row.display_order as number | null) ?? 0,
    is_active: row.is_active !== false,
  }));
}

async function applyChanges(supabase: SupabaseClient, changes: OrderChange[]) {
  for (const change of changes) {
    const { error } = await supabase
      .from("price_benchmarks")
      .update({ display_order: change.display_order })
      .eq("id", change.id);
    if (error) throw error;
  }
}

function readServes(formData: FormData): string {
  const raw = formData.getAll("serves").map((v) => v.toString().trim().toLowerCase());
  const kept = SERVES.filter((serve) => raw.includes(serve)) as Serve[];
  return kept.join(",");
}

function readKey(formData: FormData): string {
  return (formData.get("key")?.toString() ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function savePriceRoundAction(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id")?.toString();
  const key = readKey(formData);
  const label = formData.get("label")?.toString().trim() || "";
  const serves = readServes(formData);
  const isActive = formData.get("is_active") !== "false";
  const targetPositionRaw = formData.get("display_order")?.toString().trim() ?? "";
  const targetPosition = targetPositionRaw === "" ? null : Number(targetPositionRaw);

  if (!key) return { error: "A key is required." };
  if (!label) return { error: "A label is required." };
  if (!serves) return { error: "Pick at least one serve." };

  const employeeId = await getCurrentEmployeeId(supabase);
  const now = new Date().toISOString();

  try {
    const rows = await loadOrderRows(supabase);
    const plan = planSave(rows, {
      id: id ? Number(id) : null,
      isActive,
      targetPosition,
    });

    const payload = {
      key,
      label,
      serves,
      display_order: plan.position,
      is_active: isActive,
    };

    if (id) {
      const { error } = await supabase
        .from("price_benchmarks")
        .update({ ...payload, updated_at: now, updated_by: employeeId })
        .eq("id", Number(id));
      if (error) throw error;
    } else {
      const { error } = await supabase.from("price_benchmarks").insert({
        ...payload,
        created_at: now,
        updated_at: now,
        created_by: employeeId,
        updated_by: employeeId,
      });
      if (error) throw error;
    }

    await applyChanges(supabase, plan.changes);

    revalidatePath("/settings/price-rounds");
    revalidatePath("/marketing/trends");
    return { success: true };
  } catch (error) {
    console.error("Error saving price round:", error);
    const message = error instanceof Error ? error.message : "Failed to save round.";
    return { error: message.includes("duplicate") ? "That key is already in use." : message };
  }
}

export async function deletePriceRoundAction(id: number) {
  const supabase = await createClient();
  try {
    const rows = await loadOrderRows(supabase);

    const { error } = await supabase.from("price_benchmarks").delete().eq("id", id);
    if (error) throw error;

    await applyChanges(supabase, planDelete(rows, id));

    revalidatePath("/settings/price-rounds");
    revalidatePath("/marketing/trends");
    return { success: true };
  } catch (error) {
    console.error("Error deleting price round:", error);
    return { error: error instanceof Error ? error.message : "Failed to delete round." };
  }
}
