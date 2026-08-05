"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { gradeGalleryMedia } from "@/lib/gallery-media-quality";
import { readRemoteImageDimensions } from "@/lib/gallery-image-dimensions";
import { planSave, planDelete, type OrderChange, type OrderRow } from "@/lib/merchandise-order";
import type { SupabaseClient } from "@supabase/supabase-js";

async function loadOrderRows(supabase: SupabaseClient): Promise<OrderRow[]> {
  const { data, error } = await supabase
    .from("gallery_images")
    .select("id, title, display_order, is_active");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as number,
    name: (row.title as string | null) ?? "",
    display_order: (row.display_order as number | null) ?? 0,
    is_active: row.is_active !== false,
  }));
}

async function applyChanges(supabase: SupabaseClient, changes: OrderChange[]) {
  for (const change of changes) {
    const { error } = await supabase
      .from("gallery_images")
      .update({ display_order: change.display_order })
      .eq("id", change.id);
    if (error) throw error;
  }
}

export async function saveGalleryImageAction(formData: FormData) {
  const supabase = await createClient();

  const id = formData.get("id")?.toString();
  const isActive = formData.get("is_active") !== "false";
  const targetPositionRaw = formData.get("display_order")?.toString().trim() ?? "";
  const targetPosition = targetPositionRaw === "" ? null : Number(targetPositionRaw);

  const payload = {
    title: formData.get("title")?.toString() || "",
    description: formData.get("description")?.toString() || null,
    image_url: formData.get("image_url")?.toString() || "",
    media_type: formData.get("media_type")?.toString() || "image",
    is_active: isActive,
  };

  if (!payload.title) return { error: "Title is required." };
  if (!payload.image_url) return { error: "Image is required." };

  let previousImageUrl: string | null = null;
  if (id) {
    const { data: existing } = await supabase
      .from("gallery_images")
      .select("image_url")
      .eq("id", id)
      .maybeSingle();
    previousImageUrl = existing?.image_url ?? null;
  }

  if (payload.media_type !== "video" && payload.image_url !== previousImageUrl) {
    const dimensions = await readRemoteImageDimensions(payload.image_url);
    if (dimensions) {
      const quality = gradeGalleryMedia({ ...dimensions, kind: "image" });
      if (quality.level === "reject") return { error: quality.message };
    }
  }

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
    const rows = await loadOrderRows(supabase);
    const plan = planSave(rows, {
      id: id ? Number(id) : null,
      isActive,
      targetPosition,
    });

    const ordered = { ...payload, display_order: plan.position };

    if (id) {
      const { error } = await supabase
        .from("gallery_images")
        .update({
          ...ordered,
          updated_at: new Date().toISOString(),
          updated_by: currentEmployeeId,
        })
        .eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("gallery_images").insert({
        ...ordered,
        created_by: currentEmployeeId,
        updated_by: currentEmployeeId,
      });
      if (error) throw error;
    }

    await applyChanges(supabase, plan.changes);

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
    const rows = await loadOrderRows(supabase);

    const { error } = await supabase.from("gallery_images").delete().eq("id", id);
    if (error) throw error;

    await applyChanges(supabase, planDelete(rows, id));

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
