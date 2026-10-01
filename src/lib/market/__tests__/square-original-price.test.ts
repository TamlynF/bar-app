import { describe, expect, it } from "vitest";
import {
  originalFromRow,
  readOriginal,
  restoreStep,
  withOriginal,
  withPrice,
  type Variation,
} from "../square-original-price";

const money = (pounds: number) => ({ amount: BigInt(Math.round(pounds * 100)), currency: "GBP" as const });

function variation(data: Partial<NonNullable<Variation["itemVariationData"]>>): Variation {
  return { type: "ITEM_VARIATION", id: "V1", version: BigInt(1), itemVariationData: { itemId: "I1", ...data } } as Variation;
}

describe("readOriginal / originalFromRow", () => {
  it("records the pricing type and each priced location override", () => {
    const original = readOriginal(
      variation({
        pricingType: "FIXED_PRICING",
        priceMoney: money(4.5),
        locationOverrides: [
          { locationId: "L1", priceMoney: money(5), pricingType: "FIXED_PRICING" },
          { locationId: "L2", trackInventory: true },
        ],
      })
    );
    expect(original).toEqual({
      price: 4.5,
      pricingType: "FIXED_PRICING",
      locations: { L1: { price: 5, pricingType: "FIXED_PRICING" } },
    });
  });

  it("keeps a variable-priced drink as variable with no price", () => {
    expect(readOriginal(variation({ pricingType: "VARIABLE_PRICING" }))).toEqual({
      price: null,
      pricingType: "VARIABLE_PRICING",
      locations: {},
    });
  });

  it("reads no snapshot from a row without one, and an older price-only row as fixed", () => {
    expect(originalFromRow({ square_original_price: null, square_original_pricing_type: null })).toBeNull();
    expect(originalFromRow({ square_original_price: "3.50" })).toEqual({
      price: 3.5,
      pricingType: "FIXED_PRICING",
      locations: null,
    });
    expect(
      originalFromRow({ square_original_price: null, square_original_pricing_type: "VARIABLE_PRICING" })
    ).toEqual({ price: null, pricingType: "VARIABLE_PRICING", locations: {} });
  });
});

describe("withOriginal", () => {
  it("puts back a variable-priced drink the market forced to fixed", () => {
    const traded = withPrice(variation({ pricingType: "VARIABLE_PRICING" }), 6);
    const restored = withOriginal(traded, { price: null, pricingType: "VARIABLE_PRICING", locations: {} });
    expect(restored.itemVariationData?.pricingType).toBe("VARIABLE_PRICING");
    expect(restored.itemVariationData?.priceMoney).toBeUndefined();
  });

  it("restores each location override to its own price", () => {
    const traded = withPrice(
      variation({
        pricingType: "FIXED_PRICING",
        priceMoney: money(4),
        locationOverrides: [
          { locationId: "L1", priceMoney: money(4.5), pricingType: "FIXED_PRICING" },
          { locationId: "L2", priceMoney: money(4.2), pricingType: "FIXED_PRICING" },
        ],
      }),
      6
    );
    const restored = withOriginal(traded, {
      price: 4,
      pricingType: "FIXED_PRICING",
      locations: {
        L1: { price: 4.5, pricingType: "FIXED_PRICING" },
        L2: { price: 4.2, pricingType: "FIXED_PRICING" },
      },
    });
    expect(restored.itemVariationData?.priceMoney?.amount).toBe(BigInt(400));
    expect(restored.itemVariationData?.locationOverrides?.map((o) => o.priceMoney?.amount)).toEqual([
      BigInt(450),
      BigInt(420),
    ]);
  });

  it("gives every priced override the headline price for an older snapshot", () => {
    const traded = withPrice(
      variation({ priceMoney: money(4), locationOverrides: [{ locationId: "L1", priceMoney: money(4) }] }),
      6
    );
    const restored = withOriginal(traded, { price: 4, pricingType: "FIXED_PRICING", locations: null });
    expect(restored.itemVariationData?.locationOverrides?.[0].priceMoney?.amount).toBe(BigInt(400));
  });
});

describe("restoreStep", () => {
  const original = { price: 4, pricingType: "FIXED_PRICING", locations: {} };

  it("restores a price the market pushed", () => {
    expect(restoreStep(variation({ pricingType: "FIXED_PRICING", priceMoney: money(5.5) }), original, new Set([550]))).toBe(
      "restore"
    );
  });

  it("does nothing when Square already has the original", () => {
    expect(restoreStep(variation({ pricingType: "FIXED_PRICING", priceMoney: money(4) }), original, new Set([550]))).toBe(
      "already"
    );
  });

  it("leaves a price changed in Square during the night", () => {
    expect(restoreStep(variation({ pricingType: "FIXED_PRICING", priceMoney: money(4.8) }), original, new Set([550]))).toBe(
      "changed"
    );
  });

  it("restores when only the forced pricing type is left over", () => {
    const variable = { price: null, pricingType: "VARIABLE_PRICING", locations: {} };
    expect(restoreStep(variation({ pricingType: "FIXED_PRICING", priceMoney: money(6) }), variable, new Set([600]))).toBe(
      "restore"
    );
  });
});
