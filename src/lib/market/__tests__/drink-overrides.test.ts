import { describe, expect, it } from "vitest";
import { DEFAULT_MARKET_CONFIG } from "../types";
import { EMPTY_OVERRIDES, effectiveDrinkSettings, tradingBasePrice } from "../drink-overrides";

describe("tradingBasePrice", () => {
  it("prefers Square's price", () => {
    expect(tradingBasePrice(7.5, 7.95)).toBe(7.95);
  });

  it("falls back to the menu price when Square has none", () => {
    expect(tradingBasePrice(7.5, null)).toBe(7.5);
    expect(tradingBasePrice(7.5, 0)).toBe(7.5);
  });

  it("is null when neither has a price", () => {
    expect(tradingBasePrice(null, null)).toBeNull();
    expect(tradingBasePrice(0, null)).toBeNull();
  });
});

describe("effectiveDrinkSettings", () => {
  const config = { ...DEFAULT_MARKET_CONFIG, floorPct: 0.8, ceilPct: 1.5, crashFactor: 0.5 };

  it("opens at the base price and scales the limits from it", () => {
    expect(effectiveDrinkSettings(10, config, EMPTY_OVERRIDES)).toMatchObject({
      openingPrice: 10,
      minPrice: 8,
      maxPrice: 15,
      crashPrice: 5,
    });
  });

  it("scales the limits from an opening price override", () => {
    expect(effectiveDrinkSettings(10, config, { ...EMPTY_OVERRIDES, openingPrice: 6 })).toMatchObject({
      openingPrice: 6,
      minPrice: 4.8,
      maxPrice: 9,
      crashPrice: 3,
    });
  });

  it("keeps a limit set by hand", () => {
    expect(
      effectiveDrinkSettings(10, config, { ...EMPTY_OVERRIDES, openingPrice: 6, maxPrice: 20 })
    ).toMatchObject({ openingPrice: 6, minPrice: 4.8, maxPrice: 20 });
  });
});
