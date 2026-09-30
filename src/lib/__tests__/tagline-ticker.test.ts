import { describe, expect, it } from "vitest";
import { taglineItems } from "@/lib/tagline-ticker";

describe("taglineItems", () => {
  it("splits a comma-separated tagline into ticker items", () => {
    expect(taglineItems("Thu quiz, Fri karaoke , Sat live band")).toEqual([
      { text: "Thu quiz" },
      { text: "Fri karaoke" },
      { text: "Sat live band" },
    ]);
  });

  it("drops empty entries and falls back when nothing is left", () => {
    expect(taglineItems(" , ,")).toBeUndefined();
    expect(taglineItems(null)).toBeUndefined();
  });
});
