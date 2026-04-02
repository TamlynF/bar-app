"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type QuizCategoryConfig = {
  id?: number;
  category_name: string;
  question_count: number;
  points_per_question: number;
};

/**
 * Saves or updates a quiz category configuration.
 * Assumes a table 'quiz_category_configs' exists in Supabase.
 */
export async function saveQuizCategoryAction(formData: FormData) {
  const supabase = await createClient();
  
  const id = formData.get("id")?.toString();
  const payload = {
    category_name: formData.get("category_name")?.toString() || "",
    question_count: parseInt(formData.get("question_count")?.toString() || "10", 10),
    points_per_question: parseInt(formData.get("points_per_question")?.toString() || "1", 10),
  };

  if (!payload.category_name) {
    return { error: "Category name is required." };
  }

  try {
    if (id) {
      const { error } = await supabase
        .from("quiz_category_configs")
        .update(payload)
        .eq("id", id);
      if (error) throw error;
    } else {
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

/**
 * Deletes a quiz category configuration.
 */
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