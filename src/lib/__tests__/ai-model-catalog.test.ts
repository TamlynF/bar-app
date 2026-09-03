import { describe, expect, it } from "vitest";
import { familyVersion, isPrerelease, modelsForKind, sortNewestFirst } from "@/lib/ai/model-catalog";
import type { AiModel } from "@/lib/ai/providers/types";

const model = (id: string, kinds: AiModel["kinds"] = ["text"]): AiModel => ({
  id,
  displayName: id,
  description: "",
  inputTokenLimit: null,
  outputTokenLimit: null,
  kinds,
});

describe("sortNewestFirst", () => {
  it("orders by family version, stable before preview, then name", () => {
    const sorted = sortNewestFirst([
      model("gemini-2.5-flash"),
      model("gemini-3-pro-preview"),
      model("gemini-3.1-flash"),
      model("gemini-3-pro"),
      model("gemini-2.5-pro"),
    ]).map((m) => m.id);
    expect(sorted).toEqual([
      "gemini-3.1-flash",
      "gemini-3-pro",
      "gemini-3-pro-preview",
      "gemini-2.5-flash",
      "gemini-2.5-pro",
    ]);
  });

  it("does not mutate its input", () => {
    const input = [model("gemini-2.5-flash"), model("gemini-3-pro")];
    sortNewestFirst(input);
    expect(input.map((m) => m.id)).toEqual(["gemini-2.5-flash", "gemini-3-pro"]);
  });
});

describe("helpers", () => {
  it("parses versions and spots prereleases", () => {
    expect(familyVersion("gemini-3.1-flash-image")).toBe(3.1);
    expect(familyVersion("no-version")).toBe(0);
    expect(isPrerelease("gemini-3-pro-preview")).toBe(true);
    expect(isPrerelease("gemini-3-pro")).toBe(false);
  });

  it("filters by kind", () => {
    const models = [model("gemini-2.5-flash"), model("gemini-2.5-flash-image", ["image"])];
    expect(modelsForKind(models, "image").map((m) => m.id)).toEqual(["gemini-2.5-flash-image"]);
    expect(modelsForKind(models, "text").map((m) => m.id)).toEqual(["gemini-2.5-flash"]);
  });
});
