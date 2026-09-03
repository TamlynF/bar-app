import { describe, expect, it } from "vitest";
import { AI_AREAS, AI_AREA_KEYS, aiArea, isAiAreaKey } from "@/lib/ai/areas";
import { AI_PROVIDERS, providersCovering, providerCovers, aiProvider } from "@/lib/ai/providers/registry";
import { QUIZ_IMAGE_MODEL, QUIZ_TEXT_MODEL } from "@/lib/quiz/question-origin";

describe("AI areas registry", () => {
  it("has unique keys", () => {
    expect(new Set(AI_AREA_KEYS).size).toBe(AI_AREAS.length);
  });

  it("starts the quiz areas on the models the generator has always used", () => {
    expect(aiArea("quiz_questions").defaultModel).toBe(QUIZ_TEXT_MODEL);
    expect(aiArea("quiz_songs").defaultModel).toBe(QUIZ_TEXT_MODEL);
    expect(aiArea("quiz_pictures").defaultModel).toBe(QUIZ_TEXT_MODEL);
    expect(aiArea("quiz_images").defaultModel).toBe(QUIZ_IMAGE_MODEL);
    expect(aiArea("quiz_images").kind).toBe("image");
  });

  it("only defaults to a provider that can do what the area needs", () => {
    for (const area of AI_AREAS) {
      expect(providerCovers(aiProvider(area.defaultProvider), area.needs)).toBe(true);
    }
  });

  it("guards keys", () => {
    expect(isAiAreaKey("menu_import")).toBe(true);
    expect(isAiAreaKey("dashboard")).toBe(false);
    expect(isAiAreaKey(null)).toBe(false);
  });
});

describe("AI providers registry", () => {
  it("has unique ids and a key variable each", () => {
    expect(new Set(AI_PROVIDERS.map((p) => p.id)).size).toBe(AI_PROVIDERS.length);
    for (const provider of AI_PROVIDERS) expect(provider.apiKeyEnv.length).toBeGreaterThan(0);
  });

  it("offers only providers covering an area's needs", () => {
    expect(providersCovering(["image"]).map((p) => p.id)).toContain("gemini");
    expect(providersCovering(["text", "search", "file", "image", "json"]).map((p) => p.id)).toEqual(["gemini"]);
  });
});
