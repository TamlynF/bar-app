"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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
};

export async function saveQuizCategoryAction(formData: FormData) {
  const supabase = await createClient();

  const id = formData.get("id")?.toString();
  const is_active = formData.get("is_active") === "on";
  const include_spotify = formData.get("include_spotify") === "on";
  const is_picture = formData.get("is_picture") === "on";
  const is_higher_lower = formData.get("is_higher_lower") === "on";
  const order_no = parseInt(formData.get("order_no")?.toString() || "1", 10);
  const category_name = formData.get("category_name")?.toString() || "";
  const short_name_raw = formData.get("short_name")?.toString() || "";
  const short_name = short_name_raw || category_name.substring(0, 3).toUpperCase();

  if (!category_name) {
    return { error: "Category name is required." };
  }

  if (is_active) {
    let dupQuery = supabase
      .from("quiz_category_configs")
      .select("id")
      .eq("order_no", order_no)
      .eq("is_active", true);
    if (id) dupQuery = dupQuery.neq("id", id);
    const { data: dup } = await dupQuery.maybeSingle();
    if (dup) {
      return { error: `Order number ${order_no} is already used by another active category.` };
    }
  }

  const payload = {
    category_name,
    question_count: parseInt(formData.get("question_count")?.toString() || "10", 10),
    points_per_question: parseInt(formData.get("points_per_question")?.toString() || "1", 10),
    is_active,
    order_no,
    include_spotify,
    short_name,
    is_picture,
    is_higher_lower,
  };

  try {
    if (id) {
      const { error } = await supabase
        .from("quiz_category_configs")
        .update(payload)
        .eq("id", id);
      if (error) throw error;
    } else {
      const { data: maxRow } = await supabase
        .from("quiz_category_configs")
        .select("order_no")
        .order("order_no", { ascending: false })
        .limit(1)
        .maybeSingle();
      payload.order_no = (maxRow?.order_no ?? 0) + 1;

      const { error } = await supabase
        .from("quiz_category_configs")
        .insert(payload);
      if (error) throw error;
    }

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
    const { error } = await supabase
      .from("quiz_category_configs")
      .delete()
      .eq("id", id);
    if (error) throw error;

    revalidatePath("/event-setups/quiz-categories");
    return { success: true };
  } catch (error) {
    console.error("Error deleting quiz category:", error);
    return { error: error instanceof Error ? error.message : "Failed to delete category." };
  }
}
