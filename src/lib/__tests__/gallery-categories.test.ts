import { describe, expect, it } from "vitest";
import {
  buildGalleryGroups,
  countLabel,
  EVERYTHING_ELSE_SLUG,
  pickCover,
  slugify,
  toGalleryMedia,
  type GalleryCategory,
  type GalleryMedia,
} from "@/lib/gallery-categories";

const cat = (id: number, name: string, order: number, extra: Partial<GalleryCategory> = {}): GalleryCategory => ({
  id,
  name,
  slug: slugify(name),
  cover_image_id: null,
  display_order: order,
  is_active: true,
  ...extra,
});

const item = (id: number, categoryIds: number[], extra: Partial<GalleryMedia> = {}): GalleryMedia => ({
  id,
  title: `Item ${id}`,
  description: null,
  image_url: `https://x/${id}.jpg`,
  media_type: "image",
  created_at: `2026-10-0${id}T12:00:00Z`,
  category_ids: categoryIds,
  ...extra,
});

describe("slugify", () => {
  it("makes a clean slug", () => {
    expect(slugify("Karaoke nights")).toBe("karaoke-nights");
    expect(slugify("  Food & Drink!! ")).toBe("food-and-drink");
    expect(slugify("Café terrace")).toBe("cafe-terrace");
    expect(slugify("!!!")).toBe("");
  });
});

describe("buildGalleryGroups", () => {
  const categories = [cat(1, "Outside", 2), cat(2, "Karaoke nights", 1), cat(3, "Quiz nights", 3)];

  it("orders by display order, skips empty categories and repeats multi-category items", () => {
    const groups = buildGalleryGroups(categories, [item(1, [1, 2]), item(2, [1])]);
    expect(groups.map((g) => g.slug)).toEqual(["karaoke-nights", "outside"]);
    expect(groups[0].items.map((i) => i.id)).toEqual([1]);
    expect(groups[1].items.map((i) => i.id)).toEqual([1, 2]);
  });

  it("puts uncategorised items, and items only in hidden categories, under Everything else", () => {
    const hidden = [...categories, cat(4, "Old", 4, { is_active: false })];
    const groups = buildGalleryGroups(hidden, [item(1, [1]), item(2, []), item(3, [4])]);
    const last = groups[groups.length - 1];
    expect(last.slug).toBe(EVERYTHING_ELSE_SLUG);
    expect(last.items.map((i) => i.id)).toEqual([2, 3]);
    expect(groups.some((g) => g.slug === "old")).toBe(false);
  });

  it("returns nothing for an empty gallery", () => {
    expect(buildGalleryGroups(categories, [])).toEqual([]);
  });

  it("counts photos and videos", () => {
    const [g] = buildGalleryGroups(categories, [item(1, [2]), item(2, [2], { media_type: "video" }), item(3, [2])]);
    expect([g.photos, g.videos]).toEqual([2, 1]);
    expect(countLabel(g)).toBe("2 photos · 1 video");
    expect(countLabel({ photos: 1, videos: 0 })).toBe("1 photo");
  });
});

describe("pickCover", () => {
  const items = [item(1, []), item(3, [], { media_type: "video" }), item(2, [])];

  it("uses the chosen cover when it is in the group", () => {
    expect(pickCover(items, 1).id).toBe(1);
  });

  it("falls back to the newest photo, then the newest item", () => {
    expect(pickCover(items, 99).id).toBe(2);
    expect(pickCover([item(4, [], { media_type: "video" })], null).id).toBe(4);
  });
});

describe("toGalleryMedia", () => {
  it("flattens the joined category rows", () => {
    const [m] = toGalleryMedia([{ ...item(1, []), categories: [{ category_id: 5 }, { category_id: 6 }] }]);
    expect(m.category_ids).toEqual([5, 6]);
    expect(toGalleryMedia([{ ...item(2, []), categories: null }])[0].category_ids).toEqual([]);
  });
});
