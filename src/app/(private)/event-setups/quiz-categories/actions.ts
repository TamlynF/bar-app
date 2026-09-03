"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getCurrentEmployeeId } from "@/lib/current-employee";
import { promptKindFor, promptToStore, unknownPromptTokens } from "@/lib/quiz/prompt-templates";
import { isRoundType, roundTypeFlags } from "@/lib/quiz/round-kind";
import { planSave, planDelete, type OrderChange, type OrderRow } from "@/lib/merchandise-order";
import type { SupabaseClient } from "@supabase/supabase-js";

// Rounds run 1..N across the active categories and an inactive one sits at 0,
// so the numbering is derived rather than typed in and can never collide.
async function loadOrderRows(supabase: SupabaseClient): Promise<OrderRow[]> {
  const { data, error } = await supabase
    .from("quiz_category_configs")
    .select("id, category_name, order_no, is_active");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as number,
    name: (row.category_name as string) ?? "",
    display_order: (row.order_no as number) ?? 0,
    is_active: !!row.is_active,
  }));
}

async function applyChanges(supabase: SupabaseClient, changes: OrderChange[]) {
  for (const change of changes) {
    const { error } = await supabase
      .from("quiz_category_configs")
      .update({ order_no: change.display_order })
      .eq("id", change.id);
    if (error) throw error;
  }
}

export type QuizCategoryConfig = {
  id?: number;
  category_name: string;
  question_count: number;
  points_per_question: number;
  is_active: boolean;
  order_no: number;
  include_spotify: boolean;
  short_name: string;
  is_picture: boolean;
  is_higher_lower: boolean;
  number_by_release_year: boolean;
  min_years: number;
  max_years: number;
  ai_prompt: string | null;
  created_at?: string;
  updated_at?: string | null;
  created_by?: number | null;
  updated_by?: number | null;
};

export async function saveQuizCategoryAction(formData: FormData) {
  const supabase = await createClient();

  const id = formData.get("id")?.toString();
  const is_active = formData.get("is_active") === "on";
  const roundTypeRaw = formData.get("round_type");
  const { include_spotify, is_higher_lower, is_picture } = roundTypeFlags(
    isRoundType(roundTypeRaw) ? roundTypeRaw : "default"
  );
  /* A Higher-or-Lower round is numbered by the order it was picked in, because
     that order is the chain, so it never gets the choice. */
  const number_by_release_year =
    !is_higher_lower && formData.get("number_by_release_year") !== "added";
  /* Guarded here as well as by a check constraint - a zero gap would leave a
     question whose release year matches the year it is compared against, and
     neither answer would be right. */
  const min_years = Math.max(1, parseInt(formData.get("min_years")?.toString() || "3", 10) || 3);
  const max_years = Math.max(min_years, parseInt(formData.get("max_years")?.toString() || "10", 10) || min_years);
  const targetRaw = formData.get("order_no")?.toString().trim() ?? "";
  const targetPosition = targetRaw === "" ? null : Number(targetRaw);
  const category_name = formData.get("category_name")?.toString() || "";
  const short_name_raw = formData.get("short_name")?.toString() || "";
  const short_name = short_name_raw || category_name.substring(0, 3).toUpperCase();

  if (!category_name) {
    return { error: "Category name is required." };
  }

  const promptKind = promptKindFor({
    isPicture: is_picture,
    includeSpotify: include_spotify,
    isHigherLower: is_higher_lower,
  });
  const ai_prompt = promptToStore(promptKind, formData.get("ai_prompt")?.toString());
  const unknownTokens = unknownPromptTokens(promptKind, ai_prompt);
  if (unknownTokens.length > 0) {
    return {
      error: `This prompt has no field called ${unknownTokens.map((t) => `{{${t}}}`).join(", ")}. Use one of the fields listed below the prompt, or remove it.`,
    };
  }

  const currentEmployeeId = await getCurrentEmployeeId(supabase);
  const now = new Date().toISOString();

  try {
    const rows = await loadOrderRows(supabase);
    const plan = planSave(rows, {
      id: id ? Number(id) : null,
      isActive: is_active,
      targetPosition,
    });

    const payload = {
      category_name,
      question_count: parseInt(formData.get("question_count")?.toString() || "10", 10),
      points_per_question: parseInt(formData.get("points_per_question")?.toString() || "1", 10),
      is_active,
      order_no: plan.position,
      include_spotify,
      short_name,
      is_picture,
      is_higher_lower,
      number_by_release_year,
      min_years,
      max_years,
      ai_prompt,
    };

    if (id) {
      const { error } = await supabase
        .from("quiz_category_configs")
        .update({ ...payload, updated_at: now, updated_by: currentEmployeeId })
        .eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("quiz_category_configs").insert({
        ...payload,
        created_at: now,
        updated_at: now,
        created_by: currentEmployeeId,
        updated_by: currentEmployeeId,
      });
      if (error) throw error;
    }

    await applyChanges(supabase, plan.changes);

    revalidatePath("/event-setups/quiz-categories");
    return { success: true };
  } catch (error) {
    console.error("Error saving quiz category:", error);
    return { error: error instanceof Error ? error.message : "Failed to save category." };
  }
}

export async function deleteQuizCategoryAction(id: number) {
  const supabase = await createClient();
  try {
    const rows = await loadOrderRows(supabase);

    const { error } = await supabase
      .from("quiz_category_configs")
      .delete()
      .eq("id", id);
    if (error) throw error;

    await applyChanges(supabase, planDelete(rows, id));

    revalidatePath("/event-setups/quiz-categories");
    return { success: true };
  } catch (error) {
    console.error("Error deleting quiz category:", error);
    return { error: error instanceof Error ? error.message : "Failed to delete category." };
  }
}
