import { createClient } from "@/lib/supabase/server";
import QuizCategoriesClient from "./quiz-categories-client";
import type { QuizCategoryConfig, QuizExclusion } from "./actions";

export default async function QuizCategoriesPage() {
  const supabase = await createClient();

  const [{ data, error }, { data: employees }, { data: exclusions, error: exclusionsError }] = await Promise.all([
    supabase
      .from("quiz_category_configs")
      .select("*")
      .order("order_no", { ascending: true }),
    supabase.from("employees").select("id, full_name").order("full_name", { ascending: true }),
    supabase
      .from("quiz_question_exclusions")
      .select("id, quiz_category_configs_id, content_text, created_at")
      .order("created_at", { ascending: false }),
  ]);

  if (error) {
    console.error("Error fetching quiz category configs:", error);
  }

  if (exclusionsError) {
    console.error("Error fetching never-show questions:", exclusionsError);
  }

  const configs = (data as QuizCategoryConfig[]) || [];

  return (
    <QuizCategoriesClient
      initialConfigs={configs}
      employees={employees ?? []}
      exclusions={(exclusions as QuizExclusion[]) ?? []}
    />
  );
}