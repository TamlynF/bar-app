"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getCurrentEmployeeId } from "@/lib/current-employee";
import { SERVES, type Serve } from "@/lib/menu-price";

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
  const displayOrder = parseInt(formData.get("display_order")?.toString() || "0", 10);
  const isActive = formData.get("is_active") !== "false";

  if (!key) return { error: "A key is required." };
  if (!label) return { error: "A label is required." };
  if (!serves) return { error: "Pick at least one serve." };

  const employeeId = await getCurrentEmployeeId(supabase);
  const now = new Date().toISOString();

  const payload = {
    key,
    label,
    serves,
    display_order: Number.isFinite(displayOrder) ? displayOrder : 0,
    is_active: isActive,
  };

  try {
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
    const { error } = await supabase.from("price_benchmarks").delete().eq("id", id);
    if (error) throw error;

    revalidatePath("/settings/price-rounds");
    revalidatePath("/marketing/trends");
    return { success: true };
  } catch (error) {
    console.error("Error deleting price round:", error);
    return { error: error instanceof Error ? error.message : "Failed to delete round." };
  }
}
