"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function saveSpecialAction(formData: FormData) {
  const supabase = await createClient();

  const id = formData.get("id")?.toString();
  const badgesRaw = formData.get("badges")?.toString() || "";
  const badges = badgesRaw
    .split(",")
    .map((b) => b.trim().toUpperCase())
    .filter(Boolean);

  // ISO weekday numbers (1=Mon … 7=Sun), de-duped and sorted. Empty = every day.
  const days_of_week = Array.from(
    new Set(
      formData
        .getAll("days_of_week")
        .map((d) => parseInt(d.toString(), 10))
        .filter((n) => n >= 1 && n <= 7)
    )
  ).sort((a, b) => a - b);

  const payload = {
    title: formData.get("title")?.toString() || "",
    description: formData.get("description")?.toString() || null,
    badges,
    image_url: formData.get("image_url")?.toString() || null,
    start_date: formData.get("start_date")?.toString() || null,
    end_date: formData.get("end_date")?.toString() || null,
    days_of_week,
    is_active: formData.get("is_active") !== "false",
    display_order: parseInt(formData.get("display_order")?.toString() || "0", 10),
  };

  if (!payload.title) {
    return { error: "Title is required." };
  }

  // Resolve current employee
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
    if (id) {
      const { error } = await supabase
        .from("specials")
        .update({
          ...payload,
          updated_at: new Date().toISOString(),
          updated_by: currentEmployeeId,
        })
        .eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("specials").insert({
        ...payload,
        created_by: currentEmployeeId,
        updated_by: currentEmployeeId,
      });
      if (error) throw error;
    }

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
    const { error } = await supabase.from("specials").delete().eq("id", id);
    if (error) throw error;

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
