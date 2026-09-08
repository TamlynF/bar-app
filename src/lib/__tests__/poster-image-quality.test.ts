import { describe, expect, it } from "vitest";
import { POSTER_MIN_WIDTH, posterSizeWarning } from "@/lib/poster-image-quality";

describe("posterSizeWarning", () => {
  it("warns for a small upload and names its size", () => {
    const message = posterSizeWarning({ width: 299, height: 299 });
    expect(message).toContain("299 × 299px");
    expect(message).toContain(`${POSTER_MIN_WIDTH}px wide`);
  });

  it("is quiet for a picture at or above the minimum width", () => {
    expect(posterSizeWarning({ width: POSTER_MIN_WIDTH, height: 900 })).toBeNull();
    expect(posterSizeWarning({ width: 2400, height: 1600 })).toBeNull();
  });

  it("is quiet when the size could not be read", () => {
    expect(posterSizeWarning(null)).toBeNull();
    expect(posterSizeWarning({ width: 0, height: 0 })).toBeNull();
  });

  it("honours a custom minimum", () => {
    expect(posterSizeWarning({ width: 800, height: 800 }, 600)).toBeNull();
    expect(posterSizeWarning({ width: 500, height: 800 }, 600)).not.toBeNull();
  });
});
