import { describe, expect, it } from "vitest";
import { formatUkMobile, normaliseUkMobile } from "../phone";

describe("normaliseUkMobile", () => {
  it("accepts the ways people type a UK mobile", () => {
    expect(normaliseUkMobile("07700 900123")).toBe("+447700900123");
    expect(normaliseUkMobile("+44 7700 900123")).toBe("+447700900123");
    expect(normaliseUkMobile("0044 7700900123")).toBe("+447700900123");
    expect(normaliseUkMobile("447700900123")).toBe("+447700900123");
    expect(normaliseUkMobile("(07700) 900-123")).toBe("+447700900123");
  });

  it("rejects landlines, short numbers and other countries", () => {
    expect(normaliseUkMobile("01792 123456")).toBeNull();
    expect(normaliseUkMobile("07700 9001")).toBeNull();
    expect(normaliseUkMobile("+1 415 555 0100")).toBeNull();
    expect(normaliseUkMobile("")).toBeNull();
    expect(normaliseUkMobile("hello")).toBeNull();
  });
});

describe("formatUkMobile", () => {
  it("shows the national format", () => {
    expect(formatUkMobile("+447700900123")).toBe("07700 900123");
  });

  it("leaves anything unexpected alone", () => {
    expect(formatUkMobile("+15550100")).toBe("+15550100");
  });
});
