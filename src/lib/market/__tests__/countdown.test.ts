import { describe, expect, it } from "vitest";
import { formatCountdown, secondsLeft } from "../countdown";

describe("secondsLeft", () => {
  it("rounds up so the server's figure shows the moment it arrives", () => {
    expect(secondsLeft(10_000, 0)).toBe(10);
    expect(secondsLeft(9_600, 0)).toBe(10);
    expect(secondsLeft(9_000, 0)).toBe(9);
  });

  it("never goes below zero", () => {
    expect(secondsLeft(0, 5_000)).toBe(0);
  });
});

describe("formatCountdown", () => {
  it("formats minutes and zero-padded seconds", () => {
    expect(formatCountdown(0)).toBe("0:00");
    expect(formatCountdown(9)).toBe("0:09");
    expect(formatCountdown(600)).toBe("10:00");
    expect(formatCountdown(125)).toBe("2:05");
  });
});
