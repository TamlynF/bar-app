import type { Square } from "square";

/* Square.CatalogObject is a discriminated union; only this member carries
   itemVariationData, so everything below works on the narrowed type. */
export type Variation = Extract<Square.CatalogObject, { type: "ITEM_VARIATION" }>;

export type LocationOriginal = { price: number | null; pricingType: string | null };

/* Everything about a variation's price that the market overwrites: the
   headline price, its pricing type and each priced location override.
   locations is null for a snapshot taken before overrides were recorded,
   which restores the old way - every priced override gets the headline. */
export type OriginalPrice = {
  price: number | null;
  pricingType: string;
  locations: Record<string, LocationOriginal> | null;
};

export type OriginalPriceRow = {
  square_original_price: number | string | null;
  square_original_pricing_type?: string | null;
  square_original_location_prices?: Record<string, LocationOriginal> | null;
};

const CURRENCY: Square.Currency = "GBP";
const FIXED = "FIXED_PRICING";

/* DB holds numeric(6,2) pounds; Square wants integer minor units as BigInt.
   The engine already rounds to roundStep, so Math.round only guards float noise. */
export function poundsToMoney(pounds: number): Square.Money {
  return { amount: BigInt(Math.round(pounds * 100)), currency: CURRENCY };
}

export function moneyToPounds(money: Square.Money | undefined | null): number | null {
  return money?.amount == null ? null : Number(money.amount) / 100;
}

export function pence(pounds: number | string | null | undefined): number | null {
  return pounds == null ? null : Math.round(Number(pounds) * 100);
}

export function variationPrice(obj: Variation | undefined): number | null {
  return moneyToPounds(obj?.itemVariationData?.priceMoney);
}

export function isVariation(obj: Square.CatalogObject | undefined): obj is Variation {
  return obj?.type === "ITEM_VARIATION";
}

export function readOriginal(variation: Variation): OriginalPrice {
  const data = variation.itemVariationData;
  const locations: Record<string, LocationOriginal> = {};
  for (const override of data?.locationOverrides ?? []) {
    if (!override.locationId || (!override.priceMoney && !override.pricingType)) continue;
    locations[override.locationId] = {
      price: moneyToPounds(override.priceMoney),
      pricingType: override.pricingType ?? null,
    };
  }
  return {
    price: moneyToPounds(data?.priceMoney),
    pricingType: data?.pricingType ?? FIXED,
    locations,
  };
}

/* The snapshot saved on a market instrument, or null when none was taken
   yet - such a drink is never pushed to the till. */
export function originalFromRow(row: OriginalPriceRow): OriginalPrice | null {
  if (row.square_original_pricing_type) {
    return {
      price: row.square_original_price == null ? null : Number(row.square_original_price),
      pricingType: row.square_original_pricing_type,
      locations: row.square_original_location_prices ?? {},
    };
  }
  if (row.square_original_price != null) {
    return { price: Number(row.square_original_price), pricingType: FIXED, locations: null };
  }
  return null;
}

export function originalToRow(original: OriginalPrice) {
  return {
    square_original_price: original.price,
    square_original_pricing_type: original.pricingType,
    square_original_location_prices: original.locations ?? {},
  };
}

/* Returns a NEW object with the price swapped in everywhere the POS reads it;
   everything else on the variation passes through untouched. */
export function withPrice(variation: Variation, pounds: number): Variation {
  const data = variation.itemVariationData;
  if (!data) return variation;
  const price = poundsToMoney(pounds);
  return {
    ...variation,
    itemVariationData: {
      ...data,
      /* A VARIABLE_PRICING variation has no price and makes the till prompt
         staff for an amount - force FIXED so the market price is charged. */
      pricingType: FIXED,
      priceMoney: price,
      locationOverrides: data.locationOverrides?.map((override) =>
        override.priceMoney ? { ...override, priceMoney: price, pricingType: FIXED } : override
      ),
    },
  };
}

/* The variation as it was before the market: pricing type, price (none for
   variable pricing) and each location override's own price. */
export function withOriginal(variation: Variation, original: OriginalPrice): Variation {
  const data = variation.itemVariationData;
  if (!data) return variation;
  const money = original.price == null ? undefined : poundsToMoney(original.price);
  return {
    ...variation,
    itemVariationData: {
      ...data,
      pricingType: original.pricingType as Square.CatalogPricingType,
      priceMoney: money,
      locationOverrides: data.locationOverrides?.map((override) => {
        if (original.locations == null) {
          return override.priceMoney ? { ...override, priceMoney: money, pricingType: FIXED } : override;
        }
        const saved = override.locationId ? original.locations[override.locationId] : undefined;
        if (!saved) return override;
        return {
          ...override,
          priceMoney: saved.price == null ? undefined : poundsToMoney(saved.price),
          pricingType: (saved.pricingType ?? undefined) as Square.CatalogPricingType | undefined,
        };
      }),
    },
  };
}

function matchesOriginal(variation: Variation, original: OriginalPrice): boolean {
  const data = variation.itemVariationData;
  if (pence(variationPrice(variation)) !== pence(original.price)) return false;
  if ((data?.pricingType ?? FIXED) !== original.pricingType) return false;
  return (data?.locationOverrides ?? []).every((override) => {
    if (original.locations == null) {
      return !override.priceMoney || pence(moneyToPounds(override.priceMoney)) === pence(original.price);
    }
    const saved = override.locationId ? original.locations[override.locationId] : undefined;
    if (!saved) return true;
    return pence(moneyToPounds(override.priceMoney)) === pence(saved.price);
  });
}

export type RestoreStep = "restore" | "already" | "changed";

/* Whether closing the market should put a variation back. Only a price the
   market itself pushed (or the original headline with an override still
   moved) is ours to undo; anything else was set in Square during the night
   and is left alone. */
export function restoreStep(variation: Variation, original: OriginalPrice, pushedPence: Set<number>): RestoreStep {
  if (matchesOriginal(variation, original)) return "already";
  const current = pence(variationPrice(variation));
  if (current != null && (pushedPence.has(current) || current === pence(original.price))) return "restore";
  return "changed";
}
