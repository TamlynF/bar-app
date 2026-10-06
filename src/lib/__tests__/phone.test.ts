import { describe, it, expect } from "vitest";
import { cleanPhoneInput, isValidPhone, toE164 } from "@/lib/phone";

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

describe("toE164", () => {
  it("turns UK local numbers into +44", () => {
    expect(toE164("07840582631")).toBe("+447840582631");
    expect(toE164("07840 582 631")).toBe("+447840582631");
    expect(toE164("(01234) 567-890")).toBe("+441234567890");
  });

  it("keeps international numbers and converts 00 prefixes", () => {
    expect(toE164("+44 7840 582631")).toBe("+447840582631");
    expect(toE164("0033 6 12 34 56 78")).toBe("+33612345678");
    expect(toE164("+1 415 555 0100")).toBe("+14155550100");
  });

  it("gives up on blanks and numbers too short to be real", () => {
    expect(toE164("")).toBeUndefined();
    expect(toE164(null)).toBeUndefined();
    expect(toE164("12345")).toBeUndefined();
  });
});
