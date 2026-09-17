/* Simulated sales for the live drinks market.

   Real demand reaches the engine once per tick as "new units sold per
   instrument", summed from Square's completed orders. A simulated sale is
   just another source of those units, so it goes through exactly the same
   engine path (log demand boost, decaying demand_units, surge alerts, Square
   price sync) as a pint rung through the till. Everything here is pure so it
   can be unit-tested; the DB and Square live in actions.ts / tick.ts. */

export const SIM_SOURCES = ["manual", "busy_round", "square_sandbox"] as const;
export type SimSource = (typeof SIM_SOURCES)[number];

/* Hard limits on what one click can do to the board. */
export const SIM_MAX_UNITS_PER_SALE = 50;
export const SIM_MAX_ROUND_SALES = 40;
/* Each sandbox sale is two Square API calls, so rounds rung through Square stay short. */
export const SIM_MAX_SQUARE_ROUND_SALES = 15;

export type SimSaleRow = {
  instrument_id: number;
  units: number | string;
};

/* Units per instrument from a batch of unconsumed rows, ready to merge into
   the tick's newUnitsByInstrument map. */
export function sumPendingUnits(rows: SimSaleRow[]): Map<number, number> {
  const byInstrument = new Map<number, number>();
  for (const row of rows) {
    const units = Number(row.units);
    if (!Number.isFinite(units) || units <= 0) continue;
    byInstrument.set(row.instrument_id, (byInstrument.get(row.instrument_id) ?? 0) + units);
  }
  return byInstrument;
}

/* Merge simulated units on top of till units (both count as real demand). */
export function mergeUnits(
  base: Map<number, number>,
  extra: Map<number, number>
): Map<number, number> {
  const merged = new Map(base);
  for (const [id, units] of extra) merged.set(id, (merged.get(id) ?? 0) + units);
  return merged;
}

export type BusyRoundPlan = { instrumentId: number; units: number }[];

/* A "busy round" mirrors scripts/simulate-till.ts sell: `sales` separate
   orders, each 1-3 units of one drink. `favouriteId` (if trading) is weighted
   3x so one price can be watched climbing above the rest. Sold-out drinks are
   skipped - the engine freezes their quote anyway, so a sale would only
   confuse the demand column. */
export function planBusyRound(
  instruments: { id: number; soldOut?: boolean }[],
  options: { sales: number; favouriteId?: number | null; rng?: () => number }
): BusyRoundPlan {
  const rng = options.rng ?? Math.random;
  const tradeable = instruments.filter((i) => !i.soldOut);
  if (tradeable.length === 0) return [];
  const pool = tradeable.flatMap((i) =>
    options.favouriteId != null && i.id === options.favouriteId ? [i, i, i] : [i]
  );
  const sales = Math.min(SIM_MAX_ROUND_SALES, Math.max(1, Math.floor(options.sales)));
  const plan: BusyRoundPlan = [];
  for (let n = 0; n < sales; n += 1) {
    const pick = pool[Math.floor(rng() * pool.length)];
    plan.push({ instrumentId: pick.id, units: 1 + Math.floor(rng() * 3) });
  }
  return plan;
}

export function isValidSaleUnits(units: unknown): units is number {
  return (
    typeof units === "number" &&
    Number.isInteger(units) &&
    units >= 1 &&
    units <= SIM_MAX_UNITS_PER_SALE
  );
}

export function squareSandboxDashboardUrl(section: "orders" | "items" | "transactions"): string {
  const paths = {
    orders: "/dashboard/orders",
    items: "/dashboard/items/library",
    transactions: "/dashboard/sales/transactions",
  } as const;
  return `https://app.squareupsandbox.com${paths[section]}`;
}

/* The Square dashboard addresses an item by its ITEM id, which is not what we
   store - instruments carry the ITEM_VARIATION id from the menu mapping, so
   the parent has to be read back from the catalog before this can be built. */
export function squareItemUrl(environment: "sandbox" | "production", itemId: string): string {
  const host = environment === "sandbox" ? "app.squareupsandbox.com" : "app.squareup.com";
  return `https://${host}/dashboard/items/library/${encodeURIComponent(itemId)}`;
}

export function squareTransactionUrl(
  environment: "sandbox" | "production",
  paymentId: string,
  locationId: string | null
): string {
  const host = environment === "sandbox" ? "app.squareupsandbox.com" : "app.squareup.com";
  const base = `https://${host}/dashboard/sales/transactions/${encodeURIComponent(paymentId)}`;
  return locationId ? `${base}/by-unit/${encodeURIComponent(locationId)}` : base;
}
