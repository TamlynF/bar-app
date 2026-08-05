import { describe, it, expect } from "vitest";
import {
  amountForServes,
  formatPriceText,
  isLosslessPriceText,
  normalizeServe,
  parsePriceText,
  parseServes,
} from "../menu-price";

describe("normalizeServe", () => {
  it("reads the measures a menu actually writes", () => {
    expect(normalizeServe("pint")).toBe("pint");
    expect(normalizeServe("half pint")).toBe("half pint");
    expect(normalizeServe("Half")).toBe("half pint");
    expect(normalizeServe("SINGLE")).toBe("single");
    expect(normalizeServe("btl")).toBe("bottle");
  });

  it("treats no words at all as a single way of selling it", () => {
    expect(normalizeServe("")).toBe("each");
    expect(normalizeServe(null)).toBe("each");
  });

  it("refuses a measure it does not know rather than guessing", () => {
    expect(normalizeServe("pitcher")).toBeNull();
    expect(normalizeServe("6 for")).toBeNull();
  });
});

describe("parsePriceText", () => {
  it("splits the serves out of a draught line", () => {
    expect(parsePriceText("£4.95 pint / £2.95 half pint")).toEqual([
      { serve: "pint", amount: 4.95 },
      { serve: "half pint", amount: 2.95 },
    ]);
  });

  it("splits singles from doubles", () => {
    expect(parsePriceText("£4.00 single / £7.00 double")).toEqual([
      { serve: "single", amount: 4 },
      { serve: "double", amount: 7 },
    ]);
  });

  it("reads a bare price as one serve", () => {
    expect(parsePriceText("£4.50")).toEqual([{ serve: "each", amount: 4.5 }]);
  });

  it("reads all three wine measures", () => {
    expect(parsePriceText("£6.75 small / £8.50 large / £25.00 bottle")).toEqual([
      { serve: "small", amount: 6.75 },
      { serve: "large", amount: 8.5 },
      { serve: "bottle", amount: 25 },
    ]);
  });

  it("leaves a multibuy alone - it is an offer, not a measure", () => {
    expect(parsePriceText("£4.00 / 6 for £20.00")).toEqual([{ serve: "each", amount: 4 }]);
    expect(parsePriceText("£4.50 / 2 for £8.00")).toEqual([{ serve: "each", amount: 4.5 }]);
  });

  it("drops a measure it cannot read rather than calling it 'each'", () => {
    expect(parsePriceText("£12.00 pitcher")).toEqual([]);
  });

  it("keeps the first of a repeated serve", () => {
    expect(parsePriceText("£4.00 pint / £4.50 pint")).toEqual([{ serve: "pint", amount: 4 }]);
  });

  it("returns nothing for text with no price in it", () => {
    expect(parsePriceText("market price")).toEqual([]);
    expect(parsePriceText(null)).toEqual([]);
  });
});

describe("formatPriceText", () => {
  it("round-trips the lines a menu already carries", () => {
    const lines = [
      "£4.95 pint / £2.95 half pint",
      "£4.00 single / £7.00 double",
      "£6.75 small / £8.50 large / £25.00 bottle",
      "£4.50",
      "£23.00 bottle",
    ];
    lines.forEach((line) => expect(formatPriceText(parsePriceText(line))).toBe(line));
  });

  it("writes a lone serve without naming it", () => {
    expect(formatPriceText([{ serve: "each", amount: 2.5 }])).toBe("£2.50");
  });

  it("is empty when there is nothing to show", () => {
    expect(formatPriceText([])).toBe("");
  });
});

describe("isLosslessPriceText", () => {
  it("is true when the serves carry the whole line", () => {
    expect(isLosslessPriceText("£4.95 pint / £2.95 half pint")).toBe(true);
    expect(isLosslessPriceText("£4.50")).toBe(true);
  });

  it("is false when a multibuy or unreadable measure would be lost", () => {
    expect(isLosslessPriceText("£4.00 / 6 for £20.00")).toBe(false);
    expect(isLosslessPriceText("£12.00 pitcher")).toBe(false);
    expect(isLosslessPriceText("")).toBe(false);
  });
});

describe("amountForServes", () => {
  const prices = [
    { serve: "small", amount: 5.95 },
    { serve: "large", amount: 7.95 },
  ];

  it("takes the first serve the round accepts", () => {
    expect(amountForServes(prices, ["small", "glass"])).toBe(5.95);
    expect(amountForServes(prices, ["glass", "small"])).toBe(5.95);
  });

  it("is null when the item is not sold in that measure", () => {
    expect(amountForServes(prices, ["pint"])).toBeNull();
    expect(amountForServes([], ["pint"])).toBeNull();
    expect(amountForServes(prices, [])).toBeNull();
  });
});

describe("parseServes", () => {
  it("splits the round's accepted measures", () => {
    expect(parseServes("small,glass")).toEqual(["small", "glass"]);
    expect(parseServes(" Pint , half pint ")).toEqual(["pint", "half pint"]);
    expect(parseServes("")).toEqual([]);
    expect(parseServes(null)).toEqual([]);
  });
});
