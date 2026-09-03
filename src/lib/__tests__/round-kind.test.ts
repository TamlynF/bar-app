import { describe, expect, it } from "vitest";
import {
  ROUND_TYPES,
  isRoundType,
  roundKind,
  roundTypeFlags,
  roundTypeFor,
} from "@/lib/quiz/round-kind";

describe("roundTypeFor", () => {
  it("is default when no flag is set", () => {
    expect(roundTypeFor({ include_spotify: false, is_higher_lower: false, is_picture: false })).toBe("default");
  });

  it("needs Spotify for Higher or Lower to count", () => {
    expect(roundTypeFor({ include_spotify: false, is_higher_lower: true, is_picture: false })).toBe("default");
    expect(roundTypeFor({ include_spotify: true, is_higher_lower: true, is_picture: false })).toBe("higher_lower");
    expect(roundTypeFor({ include_spotify: true, is_higher_lower: false, is_picture: false })).toBe("spotify");
  });

  it("lets picture win", () => {
    expect(roundTypeFor({ include_spotify: true, is_higher_lower: true, is_picture: true })).toBe("picture");
  });
});

describe("roundTypeFlags", () => {
  it("sets both Spotify flags for Higher or Lower and none for default", () => {
    expect(roundTypeFlags("higher_lower")).toEqual({
      include_spotify: true,
      is_higher_lower: true,
      is_picture: false,
    });
    expect(roundTypeFlags("default")).toEqual({
      include_spotify: false,
      is_higher_lower: false,
      is_picture: false,
    });
  });

  it.each(ROUND_TYPES)("round-trips %s", (type) => {
    expect(roundTypeFor(roundTypeFlags(type))).toBe(type);
  });

  it.each(ROUND_TYPES)("agrees with roundKind for %s", (type) => {
    const flags = roundTypeFlags(type);
    const kind = roundKind({ isPicture: flags.is_picture, includeSpotify: flags.include_spotify });
    expect(kind).toBe(type === "picture" ? "picture" : type === "default" ? "question" : "song");
  });
});

describe("isRoundType", () => {
  it("accepts the four values and nothing else", () => {
    expect(isRoundType("spotify")).toBe(true);
    expect(isRoundType("on")).toBe(false);
    expect(isRoundType(null)).toBe(false);
  });
});
