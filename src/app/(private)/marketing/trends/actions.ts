"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { readCompanyAddress, resolveComparisonArea, readMarketingSettings } from "../lib/settings";
import { refreshTrends, ownIdeaRow, type OwnIdeaInput, type RefreshResult } from "../lib/refresh-trends";
import type { TrendKind, TrendState } from "../lib/types";

async function currentEmployeeId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<number | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const { data: emp } = await supabase
    .from("employees")
    .select("id")
    .eq("email", user.email)
    .maybeSingle();
  return emp?.id ?? null;
}

export async function refreshTrendsAction(kind?: TrendKind): Promise<RefreshResult> {
  const supabase = await createClient();
  const employeeId = await currentEmployeeId(supabase);
  const result = await refreshTrends(supabase, employeeId, kind);
  if ("success" in result) revalidatePath("/marketing/trends");
  return result;
}

export async function setTrendStateAction(
  id: string,
  state: TrendState,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const employeeId = await currentEmployeeId(supabase);
  const { error } = await supabase
    .from("marketing_trends")
    .update({ state, updated_at: new Date().toISOString(), updated_by: employeeId })
    .eq("id", id);
  if (error) {
    console.error("Error updating trend state:", error);
    return { error: error.message };
  }
  revalidatePath("/marketing/trends");
  return { success: true };
}

/* Staff-authored card. Lands on the board as "new" like an AI one, and its
   signature means a later AI refresh can't duplicate it. Returns "exists" when
   the same title was already added by hand so the UI can say so. */
export async function addOwnIdeaAction(
  input: OwnIdeaInput,
): Promise<{ success: true; exists: boolean } | { error: string }> {
  const title = input.title.trim();
  if (title.length < 3) return { error: "Give the idea a title first." };
  if (title.length > 80) return { error: "Keep the title under 80 characters." };

  const supabase = await createClient();
  const [employeeId, address, settings] = await Promise.all([
    currentEmployeeId(supabase),
    readCompanyAddress(supabase),
    readMarketingSettings(supabase),
  ]);
  const area = resolveComparisonArea(settings, address);

  const { error, count } = await supabase
    .from("marketing_trends")
    .upsert(ownIdeaRow(input, area, employeeId), {
      onConflict: "signature",
      ignoreDuplicates: true,
      count: "exact",
    });
  if (error) {
    console.error("Error adding own idea:", error);
    return { error: error.message };
  }
  revalidatePath("/marketing/trends");
  return { success: true, exists: (count ?? 0) === 0 };
}
