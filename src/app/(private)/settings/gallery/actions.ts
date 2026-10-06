"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { gradeGalleryMedia } from "@/lib/gallery-media-quality";
import { readRemoteImageDimensions } from "@/lib/gallery-image-dimensions";
import { planSave, planDelete, type OrderChange, type OrderRow } from "@/lib/merchandise-order";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EVERYTHING_ELSE_SLUG, slugify } from "@/lib/gallery-categories";

function revalidateGallery() {
  revalidatePath("/settings/gallery");
  revalidatePath("/gallery", "layout");
  revalidatePath("/");
}

async function currentEmployee(supabase: SupabaseClient): Promise<number | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const { data: emp } = await supabase.from("employees").select("id").eq("email", user.email).maybeSingle();
  return (emp?.id as number | undefined) ?? null;
}

async function syncImageCategories(supabase: SupabaseClient, imageId: number, categoryIds: number[]) {
  const { data: existing, error } = await supabase
    .from("gallery_image_categories")
    .select("category_id")
    .eq("image_id", imageId);
  if (error) throw error;
  const had = new Set((existing ?? []).map((r) => r.category_id as number));
  const want = new Set(categoryIds);
  const removed = [...had].filter((id) => !want.has(id));
  const added = [...want].filter((id) => !had.has(id));
  if (removed.length) {
    const { error: delError } = await supabase
      .from("gallery_image_categories")
      .delete()
      .eq("image_id", imageId)
      .in("category_id", removed);
    if (delError) throw delError;
  }
  if (added.length) {
    const { error: addError } = await supabase
      .from("gallery_image_categories")
      .insert(added.map((category_id) => ({ image_id: imageId, category_id })));
    if (addError) throw addError;
  }
}

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

  const categoryIds = [
    ...new Set(
      formData
        .getAll("category_ids")
        .map((v) => Number(v))
        .filter((n) => Number.isInteger(n) && n > 0)
    ),
  ];

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

    let imageId = id ? Number(id) : null;
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
      const { data: inserted, error } = await supabase
        .from("gallery_images")
        .insert({
          ...ordered,
          created_by: currentEmployeeId,
          updated_by: currentEmployeeId,
        })
        .select("id")
        .single();
      if (error) throw error;
      imageId = inserted.id as number;
    }

    await applyChanges(supabase, plan.changes);
    if (imageId != null) await syncImageCategories(supabase, imageId, categoryIds);

    revalidateGallery();
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

    revalidateGallery();
    return { success: true };
  } catch (error) {
    console.error("Error deleting gallery image:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to delete image.",
    };
  }
}

type CategoryResult = { error?: string; success?: true };

async function uniqueSlug(supabase: SupabaseClient, name: string, exceptId: number | null): Promise<string | null> {
  const base = slugify(name);
  if (!base) return null;
  const { data } = await supabase.from("gallery_categories").select("id, slug").like("slug", `${base}%`);
  const taken = new Set(
    (data ?? []).filter((r) => (r.id as number) !== exceptId).map((r) => r.slug as string)
  );
  taken.add(EVERYTHING_ELSE_SLUG);
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

export async function saveGalleryCategoryAction(input: {
  id?: number;
  name: string;
  cover_image_id?: number | null;
}): Promise<CategoryResult> {
  const supabase = await createClient();
  const name = input.name.trim().replace(/\s+/g, " ");
  if (!name) return { error: "Give the category a name." };
  if (slugify(name) === EVERYTHING_ELSE_SLUG) {
    return { error: "That name is kept for items with no category." };
  }

  const empId = await currentEmployee(supabase);
  const slug = await uniqueSlug(supabase, name, input.id ?? null);
  if (!slug) return { error: "Use at least one letter or number in the name." };

  if (input.id) {
    const { error } = await supabase
      .from("gallery_categories")
      .update({
        name,
        slug,
        ...(input.cover_image_id !== undefined ? { cover_image_id: input.cover_image_id } : {}),
        updated_at: new Date().toISOString(),
        updated_by: empId,
      })
      .eq("id", input.id);
    if (error) {
      console.error("Gallery category save failed:", error.message);
      return { error: "Couldn't save the category." };
    }
  } else {
    const { data: last } = await supabase
      .from("gallery_categories")
      .select("display_order")
      .order("display_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await supabase.from("gallery_categories").insert({
      name,
      slug,
      display_order: ((last?.display_order as number | undefined) ?? 0) + 1,
      created_by: empId,
      updated_by: empId,
    });
    if (error) {
      console.error("Gallery category create failed:", error.message);
      return { error: "Couldn't add the category." };
    }
  }
  revalidateGallery();
  return { success: true };
}

export async function setGalleryCategoryActiveAction(id: number, isActive: boolean): Promise<CategoryResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("gallery_categories")
    .update({ is_active: isActive, updated_at: new Date().toISOString(), updated_by: await currentEmployee(supabase) })
    .eq("id", id);
  if (error) {
    console.error("Gallery category toggle failed:", error.message);
    return { error: "Couldn't update the category." };
  }
  revalidateGallery();
  return { success: true };
}

/* Swaps a category with its neighbour. The list is renumbered 1..N as it
   goes, so gaps left by deletes never break the swap. */
export async function moveGalleryCategoryAction(id: number, direction: -1 | 1): Promise<CategoryResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gallery_categories")
    .select("id, display_order, name")
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) return { error: "Couldn't reorder the categories." };
  const ids = (data ?? []).map((r) => r.id as number);
  const at = ids.indexOf(id);
  const to = at + direction;
  if (at < 0 || to < 0 || to >= ids.length) return { success: true };
  [ids[at], ids[to]] = [ids[to], ids[at]];
  for (const [i, rowId] of ids.entries()) {
    const { error: upError } = await supabase
      .from("gallery_categories")
      .update({ display_order: i + 1 })
      .eq("id", rowId);
    if (upError) {
      console.error("Gallery category reorder failed:", upError.message);
      return { error: "Couldn't reorder the categories." };
    }
  }
  revalidateGallery();
  return { success: true };
}

export async function deleteGalleryCategoryAction(id: number): Promise<CategoryResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("gallery_categories").delete().eq("id", id);
  if (error) {
    console.error("Gallery category delete failed:", error.message);
    return { error: "Couldn't delete the category." };
  }
  revalidateGallery();
  return { success: true };
}
