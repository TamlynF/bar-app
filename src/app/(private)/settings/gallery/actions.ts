"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function saveGalleryImageAction(formData: FormData) {
  const supabase = await createClient();

  const id = formData.get("id")?.toString();

  const payload = {
    title: formData.get("title")?.toString() || "",
    description: formData.get("description")?.toString() || null,
    image_url: formData.get("image_url")?.toString() || "",
    media_type: formData.get("media_type")?.toString() || "image",
    is_active: formData.get("is_active") !== "false",
    display_order: parseInt(formData.get("display_order")?.toString() || "0", 10),
  };

  if (!payload.title) return { error: "Title is required." };
  if (!payload.image_url) return { error: "Image is required." };

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
        .from("gallery_images")
        .update({
          ...payload,
          updated_at: new Date().toISOString(),
          updated_by: currentEmployeeId,
        })
        .eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("gallery_images").insert({
        ...payload,
        created_by: currentEmployeeId,
        updated_by: currentEmployeeId,
      });
      if (error) throw error;
    }

    revalidatePath("/settings/gallery");
    revalidatePath("/gallery");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error saving gallery image:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to save image.",
    };
  }
}

export async function deleteGalleryImageAction(id: number) {
  const supabase = await createClient();

  try {
    const { error } = await supabase.from("gallery_images").delete().eq("id", id);
    if (error) throw error;

    revalidatePath("/settings/gallery");
    revalidatePath("/gallery");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error deleting gallery image:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to delete image.",
    };
  }
}
