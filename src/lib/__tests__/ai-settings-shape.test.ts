import { describe, expect, it } from "vitest";
import { AI_AREAS } from "@/lib/ai/areas";
import { AI_PROVIDERS } from "@/lib/ai/providers/registry";
import {
  applyChoices,
  defaultChoices,
  distinctEndpoints,
  mergeAiSettings,
  reconcile,
  type StoredArea,
  type StoredMaps,
} from "@/lib/ai/settings-shape";
import { QUIZ_IMAGE_MODEL, QUIZ_TEXT_MODEL } from "@/lib/quiz/question-origin";

const T1 = "2026-09-05T10:00:00.000Z";
const T2 = "2026-10-01T08:30:00.000Z";

function fresh(): StoredMaps {
  return reconcile(null, T1, 3).maps;
}

describe("reconcile", () => {
  it("creates every registry entry on an empty row, stamped by the employee", () => {
    const { maps, changed } = reconcile(null, T1, 3);
    expect(changed).toBe(true);
    expect(Object.keys(maps.areas).sort()).toEqual(AI_AREAS.map((a) => a.key).sort());
    expect(Object.keys(maps.providers)).toEqual(AI_PROVIDERS.map((p) => p.id));
    const area = maps.areas.quiz_images;
    expect(area).toMatchObject({
      label: "Picture round: drawing the pictures (image)",
      kind: "image",
      provider: "gemini",
      model: QUIZ_IMAGE_MODEL,
      api_base_url: null,
      active: true,
      created_at: T1,
      updated_at: T1,
      created_by: 3,
      updated_by: 3,
    });
  });

  it("reports no change and keeps stamps when nothing moved", () => {
    const first = fresh();
    const { maps, changed } = reconcile(first, T2, 7);
    expect(changed).toBe(false);
    expect(maps.areas.quiz_questions.updated_at).toBe(T1);
    expect(maps.areas.quiz_questions.updated_by).toBe(3);
  });

  it("retires an entry whose code is gone, moving only the updated stamp", () => {
    const first = fresh();
    const ghost: StoredArea = { ...first.areas.quiz_questions, label: "Dashboard summary" };
    const { maps, changed } = reconcile({ ...first, areas: { ...first.areas, dashboard_summary: ghost } }, T2, 7);
    expect(changed).toBe(true);
    expect(maps.areas.dashboard_summary).toMatchObject({
      active: false,
      created_at: T1,
      created_by: 3,
      updated_at: T2,
      updated_by: 7,
      label: "Dashboard summary",
    });
  });

  it("reactivates a retired entry when its code returns", () => {
    const first = fresh();
    const retired = { ...first.areas.quiz_songs, active: false };
    const { maps } = reconcile({ ...first, areas: { ...first.areas, quiz_songs: retired } }, T2, 7);
    expect(maps.areas.quiz_songs).toMatchObject({ active: true, updated_at: T2, updated_by: 7, created_at: T1 });
  });
});

describe("mergeAiSettings", () => {
  it("falls back to defaults with no row", () => {
    const settings = mergeAiSettings(null);
    expect(settings.areas.quiz_questions).toMatchObject({
      provider: "gemini",
      model: QUIZ_TEXT_MODEL,
      baseUrl: AI_PROVIDERS[0].defaultBaseUrl,
      providerFallback: false,
      stamp: null,
    });
  });

  it("uses stored model and layers the URLs area over provider over default", () => {
    const maps = fresh();
    maps.providers.gemini = { ...maps.providers.gemini, api_base_url: "https://p.example/v1" };
    maps.areas.quiz_questions = { ...maps.areas.quiz_questions, model: "gemini-3-pro", api_base_url: "https://a.example/v2" };
    maps.areas.quiz_songs = { ...maps.areas.quiz_songs, model: "gemini-3-flash" };
    const settings = mergeAiSettings(maps);
    expect(settings.areas.quiz_questions.baseUrl).toBe("https://a.example/v2");
    expect(settings.areas.quiz_questions.model).toBe("gemini-3-pro");
    expect(settings.areas.quiz_songs.baseUrl).toBe("https://p.example/v1");
    expect(settings.providers.gemini.overrideUrl).toBe("https://p.example/v1");
  });

  it("falls back to the area default when the stored provider is unknown", () => {
    const maps = fresh();
    maps.areas.quiz_images = { ...maps.areas.quiz_images, provider: "openai", model: "dall-e-9" };
    const settings = mergeAiSettings(maps);
    expect(settings.areas.quiz_images).toMatchObject({
      provider: "gemini",
      model: QUIZ_IMAGE_MODEL,
      providerFallback: true,
    });
  });

  it("lists retired entries separately and ignores a stale stored label", () => {
    const maps = fresh();
    maps.areas.quiz_questions = { ...maps.areas.quiz_questions, label: "Old name" };
    maps.areas.gone = { ...maps.areas.quiz_songs, active: false, label: "Gone" };
    const settings = mergeAiSettings(maps);
    expect(settings.areas.quiz_questions.label).toBe("Quiz questions");
    expect(Object.keys(settings.retiredAreas)).toEqual(["gone"]);
  });
});

describe("applyChoices", () => {
  it("touches only entries whose choice changed", () => {
    const maps = fresh();
    const choices = defaultChoices();
    choices.areas.quiz_questions = { provider: "gemini", model: "gemini-3-pro", overrideUrl: null };
    choices.providerUrls.gemini = "https://p.example/v1";
    const { maps: next, changed } = applyChoices(maps, choices, T2, 7);
    expect(changed).toBe(true);
    expect(next.areas.quiz_questions).toMatchObject({ model: "gemini-3-pro", updated_at: T2, updated_by: 7, created_at: T1 });
    expect(next.areas.quiz_songs.updated_at).toBe(T1);
    expect(next.providers.gemini).toMatchObject({ api_base_url: "https://p.example/v1", updated_at: T2 });
  });

  it("reports no change when the choices already match", () => {
    const maps = fresh();
    expect(applyChoices(maps, defaultChoices(), T2, 7).changed).toBe(false);
  });
});

describe("distinctEndpoints", () => {
  it("lists each provider and URL pair once", () => {
    const maps = fresh();
    maps.areas.quiz_questions = { ...maps.areas.quiz_questions, api_base_url: "https://a.example/v2" };
    maps.areas.quiz_songs = { ...maps.areas.quiz_songs, api_base_url: "https://a.example/v2" };
    const endpoints = distinctEndpoints(mergeAiSettings(maps));
    expect(endpoints).toEqual([
      { provider: "gemini", baseUrl: AI_PROVIDERS[0].defaultBaseUrl },
      { provider: "gemini", baseUrl: "https://a.example/v2" },
    ]);
  });
});
