import { createClient } from "@/lib/supabase/server";
import QuizCategoriesClient from "./quiz-categories-client";
import { QuizCategoryConfig } from "./actions";

export default async function QuizCategoriesPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("quiz_category_configs")
    .select("*")
    .order("order_no", { ascending: true });

  if (error) {
    console.error("Error fetching quiz category configs:", error);
  }

  const configs = (data as QuizCategoryConfig[]) || [];

  return <QuizCategoriesClient initialConfigs={configs} />;
}