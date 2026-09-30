import { describe, expect, it } from "vitest";
import { pickMixerModifier } from "../square-mixers";

describe("pickMixerModifier", () => {
  it("picks one of the list's modifiers", () => {
    expect(pickMixerModifier(["TONIC", "COKE", "RED_BULL"], () => 0)).toBe("TONIC");
    expect(pickMixerModifier(["TONIC", "COKE", "RED_BULL"], () => 0.5)).toBe("COKE");
    expect(pickMixerModifier(["TONIC", "COKE", "RED_BULL"], () => 0.9999)).toBe("RED_BULL");
  });

  it("rings the sale without a mixer when the drink has none", () => {
    expect(pickMixerModifier(undefined)).toBeNull();
    expect(pickMixerModifier([])).toBeNull();
  });
});
