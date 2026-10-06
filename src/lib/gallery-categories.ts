/* Gallery categories: how photos and videos are grouped for the home page
   tiles and the /gallery pages. An item can belong to several categories and
   shows in each; an item with none goes under "Everything else". */

export const EVERYTHING_ELSE_SLUG = "everything-else";
export const EVERYTHING_ELSE_NAME = "Everything else";

export type GalleryCategory = {
  id: number;
  name: string;
  slug: string;
  cover_image_id: number | null;
  display_order: number;
  is_active: boolean;
};

export type GalleryMedia = {
  id: number;
  title: string;
  description: string | null;
  image_url: string;
  media_type: string;
  created_at: string;
  category_ids: number[];
};

export type GalleryGroup = {
  slug: string;
  name: string;
  items: GalleryMedia[];
  cover: GalleryMedia;
  photos: number;
  videos: number;
};

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isVideo(item: Pick<GalleryMedia, "media_type">): boolean {
  return item.media_type === "video";
}

/* The tile image: the category's chosen cover when it is still in the group,
   otherwise its newest photo, otherwise its newest item of any kind. */
export function pickCover(items: GalleryMedia[], coverId: number | null): GalleryMedia {
  const chosen = coverId == null ? undefined : items.find((i) => i.id === coverId);
  if (chosen) return chosen;
  const newest = [...items].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return newest.find((i) => !isVideo(i)) ?? newest[0];
}

function group(slug: string, name: string, items: GalleryMedia[], coverId: number | null): GalleryGroup {
  const videos = items.filter(isVideo).length;
  return { slug, name, items, cover: pickCover(items, coverId), photos: items.length - videos, videos };
}

/* Active categories that have something in them, in display order, then
   "Everything else" when any item has no active category. Items keep the
   order they were given in. */
export function buildGalleryGroups(categories: GalleryCategory[], media: GalleryMedia[]): GalleryGroup[] {
  const active = categories
    .filter((c) => c.is_active)
    .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name));
  const activeIds = new Set(active.map((c) => c.id));

  const groups = active
    .map((c) => ({ c, items: media.filter((m) => m.category_ids.includes(c.id)) }))
    .filter(({ items }) => items.length > 0)
    .map(({ c, items }) => group(c.slug, c.name, items, c.cover_image_id));

  const loose = media.filter((m) => !m.category_ids.some((id) => activeIds.has(id)));
  if (loose.length > 0) groups.push(group(EVERYTHING_ELSE_SLUG, EVERYTHING_ELSE_NAME, loose, null));
  return groups;
}

export function countLabel(group: Pick<GalleryGroup, "photos" | "videos">): string {
  const parts = [];
  if (group.photos) parts.push(`${group.photos} ${group.photos === 1 ? "photo" : "photos"}`);
  if (group.videos) parts.push(`${group.videos} ${group.videos === 1 ? "video" : "videos"}`);
  return parts.join(" · ");
}

type MediaRow = Omit<GalleryMedia, "category_ids"> & {
  categories?: { category_id: number }[] | null;
};

export const GALLERY_MEDIA_SELECT =
  "id, title, description, image_url, media_type, created_at, categories:gallery_image_categories(category_id)";

export const GALLERY_CATEGORY_SELECT = "id, name, slug, cover_image_id, display_order, is_active";

export function toGalleryMedia(rows: MediaRow[]): GalleryMedia[] {
  return rows.map(({ categories, ...row }) => ({
    ...row,
    category_ids: (categories ?? []).map((c) => c.category_id),
  }));
}
