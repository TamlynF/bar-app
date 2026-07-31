import { describe, it, expect } from "vitest";
import {
  gradeGalleryMedia,
  LIGHTBOX_IDEAL_EDGE,
  LIGHTBOX_MIN_EDGE,
} from "../gallery-media-quality";

describe("gradeGalleryMedia", () => {
  it("rejects an image below the minimum long edge", () => {
    const result = gradeGalleryMedia({ width: 640, height: 480, kind: "image" });

    expect(result.level).toBe("reject");
    expect(result.longEdge).toBe(640);
    expect(result.message).toContain("640 x 480");
  });

  it("rejects a portrait image whose long edge is still too small", () => {
    expect(gradeGalleryMedia({ width: 700, height: 1100, kind: "image" }).level).toBe("reject");
  });

  it("accepts a portrait image on its long edge", () => {
    const result = gradeGalleryMedia({ width: 1080, height: 1920, kind: "image" });

    expect(result.level).toBe("good");
    expect(result.longEdge).toBe(1920);
  });

  it("warns between the minimum and the ideal", () => {
    const result = gradeGalleryMedia({
      width: LIGHTBOX_MIN_EDGE.image,
      height: 900,
      kind: "image",
    });

    expect(result.level).toBe("warn");
  });

  it("treats the ideal edge as good", () => {
    expect(
      gradeGalleryMedia({ width: LIGHTBOX_IDEAL_EDGE, height: 1080, kind: "image" }).level
    ).toBe("good");
  });

  it("holds video to the higher 720p minimum", () => {
    expect(gradeGalleryMedia({ width: 1200, height: 800, kind: "image" }).level).toBe("warn");
    expect(gradeGalleryMedia({ width: 1200, height: 800, kind: "video" }).level).toBe("reject");
    expect(gradeGalleryMedia({ width: 1280, height: 720, kind: "video" }).level).toBe("warn");
  });

  it("warns rather than rejects when dimensions are unreadable", () => {
    expect(gradeGalleryMedia({ width: 0, height: 0, kind: "image" }).level).toBe("warn");
    expect(gradeGalleryMedia({ width: NaN, height: 1920, kind: "video" }).level).toBe("warn");
  });
});
