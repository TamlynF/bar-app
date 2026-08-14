import { describe, it, expect } from "vitest";
import { topicTokens, topicSearchTokens, topicsOverlap } from "@/lib/quiz/topic-match";

describe("topicTokens", () => {
  it("drops filler words and punctuation", () => {
    expect(topicTokens("Famous dogs of the world!")).toEqual(["dog", "world"]);
  });

  it("folds simple plurals onto the singular", () => {
    expect(topicTokens("Dog breeds")).toEqual(topicTokens("Dog breed"));
  });

  it("leaves short words and double-s endings alone", () => {
    expect(topicTokens("Gas glass")).toEqual(["gas", "glass"]);
  });
});

describe("topicSearchTokens", () => {
  it("de-duplicates and caps the list", () => {
    expect(topicSearchTokens("cars cars trucks bikes boats planes vans", 3)).toEqual([
      "car",
      "truck",
      "bike",
    ]);
  });
});

describe("topicsOverlap", () => {
  it("matches a topic that names everything the other does", () => {
    expect(topicsOverlap("Famous dog breeds", "Dog breeds")).toBe(true);
    expect(topicsOverlap("Album covers", "80s album covers")).toBe(true);
  });

  it("matches the same words in a different order", () => {
    expect(topicsOverlap("World flags", "Flags of the world")).toBe(true);
  });

  it("does not match topics that only share a category word", () => {
    expect(topicsOverlap("Dog breeds", "Cat breeds")).toBe(false);
    expect(topicsOverlap("Film posters", "Album covers")).toBe(false);
  });

  it("treats an empty or filler-only topic as no match", () => {
    expect(topicsOverlap("", "Dog breeds")).toBe(false);
    expect(topicsOverlap("the of and", "Dog breeds")).toBe(false);
  });
});
