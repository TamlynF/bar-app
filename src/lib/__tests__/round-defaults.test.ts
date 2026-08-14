import { describe, it, expect } from "vitest";
import {
  lastRoundSettings,
  type RoundSettingsRow,
} from "@/lib/quiz/round-defaults";

const row = (over: Partial<RoundSettingsRow> = {}): RoundSettingsRow => ({
  quiz_category_configs_id: 1,
  topic: null,
  difficulty: null,
  image_notes: null,
  created_at: "2026-08-01T10:00:00Z",
  ...over,
});

describe("lastRoundSettings", () => {
  it("returns the settings of the most recently saved question", () => {
    const settings = lastRoundSettings([
      row({ created_at: "2026-08-01T10:00:00Z", topic: "80s", difficulty: "Easy" }),
      row({ created_at: "2026-08-02T10:00:00Z", topic: "90s", difficulty: "Hard" }),
    ]);

    expect(settings.get(1)).toEqual({ topic: "90s", difficulty: "Hard", imageNotes: "" });
  });

  it("ignores the order the rows arrive in", () => {
    const settings = lastRoundSettings([
      row({ created_at: "2026-08-02T10:00:00Z", topic: "90s" }),
      row({ created_at: "2026-08-01T10:00:00Z", topic: "80s" }),
    ]);

    expect(settings.get(1)?.topic).toBe("90s");
  });

  it("keeps each round's settings apart", () => {
    const settings = lastRoundSettings([
      row({ quiz_category_configs_id: 1, topic: "Dog breeds", image_notes: "no text" }),
      row({ quiz_category_configs_id: 2, topic: "World flags" }),
    ]);

    expect(settings.get(1)).toEqual({
      topic: "Dog breeds",
      difficulty: "",
      imageNotes: "no text",
    });
    expect(settings.get(2)?.topic).toBe("World flags");
  });

  it("lets cleared picture instructions stay cleared", () => {
    const settings = lastRoundSettings([
      row({ created_at: "2026-08-01T10:00:00Z", image_notes: "no band names" }),
      row({ created_at: "2026-08-02T10:00:00Z", image_notes: null }),
    ]);

    expect(settings.get(1)?.imageNotes).toBe("");
  });

  it("skips questions with no round", () => {
    const settings = lastRoundSettings([
      row({ quiz_category_configs_id: null, topic: "Orphan" }),
    ]);

    expect(settings.size).toBe(0);
  });

  it("has nothing to offer a round that has never been generated", () => {
    expect(lastRoundSettings([]).get(1)).toBeUndefined();
  });
});
