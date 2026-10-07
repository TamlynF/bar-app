import { describe, expect, it } from "vitest";
import { MAX_MONEY_AMOUNT, cleanMoneyInput, formatMoneyInput, parseMoney } from "@/lib/money-input";

describe("cleanMoneyInput", () => {
  it("keeps digits and one decimal point", () => {
    expect(cleanMoneyInput("250")).toBe("250");
    expect(cleanMoneyInput("250.5")).toBe("250.5");
    expect(cleanMoneyInput("250.")).toBe("250.");
  });

  it("drops minus signs, letters and currency symbols", () => {
    expect(cleanMoneyInput("-10")).toBe("10");
    expect(cleanMoneyInput("£1,200")).toBe("1200");
    expect(cleanMoneyInput("12abc")).toBe("12");
  });

  it("allows at most two decimal places and one point", () => {
    expect(cleanMoneyInput("9.999")).toBe("9.99");
    expect(cleanMoneyInput("1.2.3")).toBe("1.23");
  });

  it("trims leading zeros and fills a bare point", () => {
    expect(cleanMoneyInput("007")).toBe("7");
    expect(cleanMoneyInput(".5")).toBe("0.5");
    expect(cleanMoneyInput("0")).toBe("0");
  });
});

describe("parseMoney", () => {
  it("rounds to pence and rejects negatives, blanks and huge amounts", () => {
    expect(parseMoney("12.345")).toBe(12.35);
    expect(parseMoney(0)).toBe(0);
    expect(parseMoney(-1)).toBeNull();
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney(MAX_MONEY_AMOUNT + 1)).toBeNull();
  });
});

describe("formatMoneyInput", () => {
  it("shows pounds and pence, or nothing for an empty field", () => {
    expect(formatMoneyInput("12")).toBe("12.00");
    expect(formatMoneyInput("12.5")).toBe("12.50");
    expect(formatMoneyInput("")).toBe("");
  });
});
