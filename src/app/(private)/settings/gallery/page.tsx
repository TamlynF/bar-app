import { createClient } from "@/lib/supabase/server";
import GalleryClient from "./gallery-client";
import { GALLERY_CATEGORY_SELECT, type GalleryCategory } from "@/lib/gallery-categories";

export default async function GalleryPage() {
  const supabase = await createClient();

  const [{ data: images, error }, { data: employees }, { data: categories, error: categoryError }] =
    await Promise.all([
      supabase
        .from("gallery_images")
        .select("*, categories:gallery_image_categories(category_id)")
        .order("display_order", { ascending: true })
        .order("id", { ascending: true }),
      supabase.from("employees").select("id, full_name").order("full_name", { ascending: true }),
      supabase
        .from("gallery_categories")
        .select(GALLERY_CATEGORY_SELECT)
        .order("display_order", { ascending: true })
        .order("name", { ascending: true }),
    ]);

  if (error) console.error("Error fetching gallery images:", error);
  if (categoryError) console.error("Error fetching gallery categories:", categoryError);

  const withCategories = (images ?? []).map(({ categories: links, ...img }) => ({
    ...img,
    category_ids: ((links ?? []) as { category_id: number }[]).map((l) => l.category_id),
  }));

  return (
    <GalleryClient
      initialImages={withCategories}
      employees={employees ?? []}
      categories={(categories ?? []) as GalleryCategory[]}
    />
  );
}
