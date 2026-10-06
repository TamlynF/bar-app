import type { SupabaseClient } from "@supabase/supabase-js";
import { format } from "date-fns";
import {
  buildGalleryGroups,
  GALLERY_CATEGORY_SELECT,
  GALLERY_MEDIA_SELECT,
  toGalleryMedia,
  type GalleryCategory,
  type GalleryGroup,
  type GalleryMedia,
} from "@/lib/gallery-categories";

/* Everything the public gallery shows: active media in display order, grouped
   by category. Read by the home page tiles and both /gallery pages. */
export async function loadGalleryGroups(supabase: SupabaseClient): Promise<GalleryGroup[]> {
  const [{ data: media, error: mediaError }, { data: categories, error: categoryError }] = await Promise.all([
    supabase
      .from("gallery_images")
      .select(GALLERY_MEDIA_SELECT)
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
    supabase.from("gallery_categories").select(GALLERY_CATEGORY_SELECT),
  ]);
  if (mediaError) console.error("Gallery media load failed:", mediaError.message);
  if (categoryError) console.error("Gallery categories load failed:", categoryError.message);
  return buildGalleryGroups(
    (categories ?? []) as GalleryCategory[],
    toGalleryMedia((media ?? []) as Parameters<typeof toGalleryMedia>[0])
  );
}

export function dateLabel(item: GalleryMedia): string {
  return format(new Date(item.created_at), "d MMM yyyy");
}
