"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function savePromoAction(formData: FormData) {
  const supabase = await createClient();

  const id = formData.get("id")?.toString();

  const payload = {
    title: formData.get("title")?.toString() || "",
    description: formData.get("description")?.toString() || null,
    media_url: formData.get("media_url")?.toString() || "",
    media_type: formData.get("media_type")?.toString() || "image",
    external_url: formData.get("external_url")?.toString() || null,
    is_active: formData.get("is_active") !== "false",
    display_order: parseInt(formData.get("display_order")?.toString() || "0", 10),
  };

  if (!payload.title) return { error: "Title is required." };
  if (!payload.media_url) return { error: "Media file is required." };

  let currentEmployeeId: number | null = null;
  const { data: { user } } = await supabase.auth.getUser();
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
        .from("promo_content")
        .update({
          ...payload,
          updated_at: new Date().toISOString(),
          updated_by: currentEmployeeId,
        })
        .eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("promo_content").insert({
        ...payload,
        created_by: currentEmployeeId,
        updated_by: currentEmployeeId,
      });
      if (error) throw error;
    }

    revalidatePath("/settings/promo-content");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error saving promo:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to save promo.",
    };
  }
}

export async function deletePromoAction(id: number) {
  const supabase = await createClient();

  try {
    const { error } = await supabase.from("promo_content").delete().eq("id", id);
    if (error) throw error;

    revalidatePath("/settings/promo-content");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error deleting promo:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to delete promo.",
    };
  }
}
