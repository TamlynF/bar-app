import { describe, it, expect } from "vitest";
import { cleanPhoneInput, isValidPhone } from "@/lib/phone";

describe("isValidPhone", () => {
  it("accepts UK and international formats", () => {
    expect(isValidPhone("07700 900123")).toBe(true);
    expect(isValidPhone("+44 7700 900123")).toBe(true);
    expect(isValidPhone("(01234) 567-890")).toBe(true);
    expect(isValidPhone("+1 415.555.0100")).toBe(true);
  });

  it("rejects text, too few or too many digits", () => {
    expect(isValidPhone("call me")).toBe(false);
    expect(isValidPhone("12345")).toBe(false);
    expect(isValidPhone("1234567890123456")).toBe(false);
    expect(isValidPhone("07700 9001ab")).toBe(false);
    expect(isValidPhone("44+7700900123")).toBe(false);
  });
});

describe("cleanPhoneInput", () => {
  it("drops letters and stray plus signs as they're typed", () => {
    expect(cleanPhoneInput("07700 abc900123")).toBe("07700 900123");
    expect(cleanPhoneInput("+44+7700")).toBe("+447700");
  });
});
