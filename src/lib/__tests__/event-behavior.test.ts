import { describe, it, expect } from "vitest";
import {
  EVENT_BEHAVIORS,
  BEHAVIOR_LABELS,
  BEHAVIOR_OPTIONS,
  isEventBehavior,
  type EventBehavior,
} from "@/lib/event-behavior";

describe("EVENT_BEHAVIORS", () => {
  it("is the exact, ordered set of discriminator values", () => {
    expect(EVENT_BEHAVIORS).toEqual([
      "standard",
      "quiz",
      "bingo",
      "karaoke",
      "music_act",
      "private",
    ]);
  });

  it("has no duplicates", () => {
    expect(new Set(EVENT_BEHAVIORS).size).toBe(EVENT_BEHAVIORS.length);
  });
});

describe("BEHAVIOR_LABELS", () => {
  it("has a human label for every behavior", () => {
    for (const b of EVENT_BEHAVIORS) {
      expect(BEHAVIOR_LABELS[b]).toBeTruthy();
    }
    expect(Object.keys(BEHAVIOR_LABELS).sort()).toEqual([...EVENT_BEHAVIORS].sort());
  });

  it("maps the underscored value to a spaced title", () => {
    expect(BEHAVIOR_LABELS.music_act).toBe("Music Act");
    expect(BEHAVIOR_LABELS.private).toBe("Private Hire");
    expect(BEHAVIOR_LABELS.standard).toBe("Standard");
  });
});

describe("BEHAVIOR_OPTIONS", () => {
  it("mirrors EVENT_BEHAVIORS in order, pairing value with its label", () => {
    expect(BEHAVIOR_OPTIONS).toEqual(
      EVENT_BEHAVIORS.map((value) => ({ value, label: BEHAVIOR_LABELS[value] }))
    );
  });
});

describe("isEventBehavior", () => {
  it("accepts every canonical value", () => {
    for (const b of EVENT_BEHAVIORS) {
      expect(isEventBehavior(b)).toBe(true);
    }
  });

  it("rejects legacy names, casing variants and non-strings", () => {
    expect(isEventBehavior("games")).toBe(false);
    expect(isEventBehavior("band")).toBe(false);
    expect(isEventBehavior("music")).toBe(false);
    expect(isEventBehavior("Quiz")).toBe(false);
    expect(isEventBehavior("QUIZ")).toBe(false);
    expect(isEventBehavior("")).toBe(false);
    expect(isEventBehavior(null)).toBe(false);
    expect(isEventBehavior(undefined)).toBe(false);
    expect(isEventBehavior(0)).toBe(false);
    expect(isEventBehavior(["quiz"])).toBe(false);
  });

  it("narrows the type so a checked value is usable as EventBehavior", () => {
    const raw: unknown = "bingo";
    if (isEventBehavior(raw)) {
      const b: EventBehavior = raw; // compiles only if narrowed
      expect(b).toBe("bingo");
    } else {
      throw new Error("expected 'bingo' to narrow");
    }
  });
});
