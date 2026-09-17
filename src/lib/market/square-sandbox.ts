import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Square } from "square";
import { squareClient } from "@/lib/square";
import type { SeedMode } from "./types";

export type { SeedMode };

/* Demo path for staff: the live market's drinks are seeded into the Square
   SANDBOX catalog (session-scoped - menu_item_prices is never touched), and a
   "sale" is a real CreateOrder + CreatePayment there. tick.ts then finds the
   order through orders.search exactly as it would a till sale, and the price
   sync writes the new price back into the sandbox catalog, so the whole loop
   is visible in the Square sandbox dashboard. Refuses to run in production. */

const CURRENCY: Square.Currency = "GBP";

export type SquareSimEnvironment = {
  environment: "sandbox" | "production";
  isSandbox: boolean;
  locationId: string | null;
};

export function squareSimEnvironment(): SquareSimEnvironment {
  const environment = process.env.SQUARE_ENVIRONMENT === "production" ? "production" : "sandbox";
  return {
    environment,
    isSandbox: environment === "sandbox" && Boolean(process.env.SQUARE_ACCESS_TOKEN),
    locationId: process.env.SQUARE_LOCATION_ID ?? null,
  };
}

export function assertSandbox(): { locationId: string } | { error: string } {
  const env = squareSimEnvironment();
  if (env.environment === "production") {
    return { error: "Square is set to production here - sandbox sales are only allowed when SQUARE_ENVIRONMENT=sandbox." };
  }
  if (!process.env.SQUARE_ACCESS_TOKEN) return { error: "SQUARE_ACCESS_TOKEN is not set." };
  if (!env.locationId) return { error: "SQUARE_LOCATION_ID is not set - it must be a sandbox location." };
  return { locationId: env.locationId };
}

function poundsToMoney(pounds: number): Square.Money {
  return { amount: BigInt(Math.round(pounds * 100)), currency: CURRENCY };
}

type SeedRow = {
  id: number;
  display_name: string;
  serve: string;
  base_price: number | string;
  opening_price: number | string;
  sandbox_item_id: string | null;
  menu_variation_id: string | null;
};

export type SeedResult = {
  seeded: number;
  stocked: number;
  created: number;
  reused: number;
  deleted: number;
};

export type SeedStep =
  | { instrumentId: number; action: "reuse"; variationId: string }
  | { instrumentId: number; action: "create" };

/* "temp" always builds throwaway catalog objects, so anything a previous seed
   created is deleted first. "reuse" points an instrument at the variation its
   menu price is already mapped to and only touches stock, falling back to a
   throwaway object for drinks that have no mapping yet. */
export function planSandboxSeed(rows: SeedRow[], mode: SeedMode): SeedStep[] {
  return rows.map((row) => {
    const mapped = mode === "reuse" ? row.menu_variation_id : null;
    return mapped
      ? { instrumentId: row.id, action: "reuse" as const, variationId: mapped }
      : { instrumentId: row.id, action: "create" as const };
  });
}

export function itemIdsToDelete(rows: SeedRow[], mode: SeedMode): string[] {
  if (mode !== "temp") return [];
  return rows.map((row) => row.sandbox_item_id).filter((id): id is string => Boolean(id));
}

/* One ITEM + one ITEM_VARIATION per instrument, priced at the base (menu)
   price so the first market tick visibly moves it. Variation ids are written
   to market_instruments only, and square_original_price is set to the seeded
   price so ending the market restores the sandbox catalog too. */
export async function seedSandboxCatalog(
  supabase: SupabaseClient,
  sessionId: number,
  stockQty: number,
  mode: SeedMode = "temp"
): Promise<SeedResult | { error: string }> {
  const guard = assertSandbox();
  if ("error" in guard) return guard;
  const { locationId } = guard;

  const { data, error } = await supabase
    .from("market_instruments")
    .select(
      "id, display_name, serve, base_price, opening_price, sandbox_item_id, menu_item_prices(square_variation_id)"
    )
    .eq("session_id", sessionId);
  if (error) return { error: error.message };
  const rows = (data ?? []).map((raw) => {
    const row = raw as Omit<SeedRow, "menu_variation_id"> & {
      menu_item_prices: { square_variation_id: string | null } | { square_variation_id: string | null }[] | null;
    };
    const price = Array.isArray(row.menu_item_prices) ? row.menu_item_prices[0] : row.menu_item_prices;
    return { ...row, menu_variation_id: price?.square_variation_id ?? null } as SeedRow;
  });
  if (rows.length === 0) return { error: "No drinks on the live market to seed." };

  const plan = planSandboxSeed(rows, mode);
  const creating = new Set(
    plan.filter((step) => step.action === "create").map((step) => step.instrumentId)
  );

  const deleted = await deleteSeededItems(itemIdsToDelete(rows, mode));

  const objects: Square.CatalogObject[] = rows
    .filter((row) => creating.has(row.id))
    .map((row) => {
      const price = Number(row.base_price);
      return {
        type: "ITEM",
        id: `#inst-${row.id}`,
        presentAtAllLocations: true,
        itemData: {
          name: row.display_name,
          variations: [
            {
              type: "ITEM_VARIATION",
              id: `#var-${row.id}`,
              presentAtAllLocations: true,
              itemVariationData: {
                itemId: `#inst-${row.id}`,
                name: row.serve,
                pricingType: "FIXED_PRICING",
                priceMoney: poundsToMoney(price),
                trackInventory: true,
                locationOverrides: [
                  { locationId, priceMoney: poundsToMoney(price), pricingType: "FIXED_PRICING" },
                ],
              },
            },
          ],
        },
      };
    });

  const createdItemByInstrument = new Map<number, string>();
  const variationIds: { instrumentId: number; variationId: string }[] = [];

  if (objects.length > 0) {
    const res = await squareClient.catalog.batchUpsert({
      idempotencyKey: randomUUID(),
      batches: [{ objects }],
    });
    for (const mapping of res.idMappings ?? []) {
      if (!mapping.objectId) continue;
      const variation = mapping.clientObjectId?.match(/^#var-(\d+)$/);
      if (variation) {
        variationIds.push({ instrumentId: Number(variation[1]), variationId: mapping.objectId });
        continue;
      }
      const item = mapping.clientObjectId?.match(/^#inst-(\d+)$/);
      if (item) createdItemByInstrument.set(Number(item[1]), mapping.objectId);
    }
  }

  for (const step of plan) {
    if (step.action !== "reuse") continue;
    variationIds.push({ instrumentId: step.instrumentId, variationId: step.variationId });
  }

  const priceById = new Map(rows.map((row) => [row.id, Number(row.base_price)]));
  for (const { instrumentId, variationId } of variationIds) {
    const { error: writeError } = await supabase
      .from("market_instruments")
      .update({
        square_variation_id: variationId,
        sandbox_item_id: createdItemByInstrument.get(instrumentId) ?? null,
        square_original_price: priceById.get(instrumentId) ?? null,
        square_synced_price: null,
        square_sync_error: null,
      })
      .eq("id", instrumentId);
    if (writeError) return { error: writeError.message };
  }

  let stocked = 0;
  if (stockQty > 0 && variationIds.length > 0) {
    const occurredAt = new Date().toISOString();
    await squareClient.inventory.batchCreateChanges({
      idempotencyKey: randomUUID(),
      changes: variationIds.map(({ variationId }) => ({
        type: "PHYSICAL_COUNT",
        physicalCount: {
          catalogObjectId: variationId,
          locationId,
          state: "IN_STOCK",
          quantity: String(stockQty),
          occurredAt,
        },
      })),
      ignoreUnchangedCounts: true,
    });
    stocked = variationIds.length;
  }

  await supabase
    .from("market_sessions")
    .update({ sandbox_seeded_at: new Date().toISOString() })
    .eq("id", sessionId);

  return {
    seeded: variationIds.length,
    stocked,
    created: createdItemByInstrument.size,
    reused: variationIds.length - createdItemByInstrument.size,
    deleted,
  };
}

/* A previous seed's objects, removed before a fresh one replaces them. Square
   rejects the whole batch if any id has already gone, so a failure here is
   logged and the seed continues - a leftover duplicate is better than a seed
   that cannot run. */
async function deleteSeededItems(itemIds: string[]): Promise<number> {
  if (itemIds.length === 0) return 0;
  let deleted = 0;
  for (let i = 0; i < itemIds.length; i += 200) {
    const chunk = itemIds.slice(i, i + 200);
    try {
      const res = await squareClient.catalog.batchDelete({ objectIds: chunk });
      deleted += res.deletedObjectIds?.length ?? 0;
    } catch (err) {
      console.error("[market] sandbox catalog cleanup failed:", err);
    }
  }
  return deleted;
}

/* Additive stock: an ADJUSTMENT from NONE into IN_STOCK, which is how Square
   records a delivery. Works in production as well as the sandbox - it is a
   real inventory change either way. */
export function inventoryAdditionChange(
  locationId: string,
  variationId: string,
  quantity: number,
  occurredAt: string
): Square.InventoryChange {
  return {
    type: "ADJUSTMENT",
    adjustment: {
      catalogObjectId: variationId,
      fromState: "NONE",
      toState: "IN_STOCK",
      fromLocationId: locationId,
      toLocationId: locationId,
      quantity: String(Math.floor(quantity)),
      occurredAt,
    },
  };
}

export async function addInventory(
  locationId: string,
  variationId: string,
  quantity: number
): Promise<void> {
  await squareClient.inventory.batchCreateChanges({
    idempotencyKey: randomUUID(),
    changes: [inventoryAdditionChange(locationId, variationId, quantity, new Date().toISOString())],
  });
}

export type SaleLine = { variationId: string; quantity: number };
export type RungSale = {
  orderId: string;
  paymentId: string;
  amount: number;
  tender: TenderChoice;
};

/* Exactly what the POS does: an order with catalog line items, then a payment
   that autocompletes. An order with no fulfilment flips to COMPLETED the moment
   it is fully paid, which is the state tick.ts polls for. */
export async function ringSaleThroughSquare(
  locationId: string,
  lines: SaleLine[],
  tender: TenderChoice
): Promise<RungSale> {
  const orderRes = await squareClient.orders.create({
    idempotencyKey: randomUUID(),
    order: {
      locationId,
      source: { name: "Don Fenticas market demo" },
      lineItems: lines.map((line) => ({
        catalogObjectId: line.variationId,
        quantity: String(line.quantity),
      })),
    },
  });
  const order = orderRes.order;
  const total = order?.totalMoney;
  if (!order?.id || total?.amount == null) {
    throw new Error("Square did not return an order id and total.");
  }

  const payRes = await squareClient.payments.create({
    idempotencyKey: randomUUID(),
    sourceId: tender === "cash" ? "CASH" : "cnon:card-nonce-ok",
    amountMoney: total,
    orderId: order.id,
    locationId,
    autocomplete: true,
    ...(tender === "cash"
      ? { cashDetails: { buyerSuppliedMoney: { amount: total.amount, currency: CURRENCY } } }
      : {}),
  });
  const payment = payRes.payment;
  if (!payment?.id || payment.status !== "COMPLETED") {
    throw new Error(`Sandbox payment ${payment?.id ?? ""} ended in status ${payment?.status ?? "unknown"}.`);
  }

  return {
    orderId: order.id,
    paymentId: payment.id,
    amount: Number(total.amount) / 100,
    tender,
  };
}

export type TenderChoice = "card" | "cash";
export type RoundTenderMode = TenderChoice | "mix";

const MIX_CASH_SHARE = 0.3;

/* A round's tenders decided up front rather than per sale, so "mix" always
   lands on the same card/cash split for a given size instead of drifting with
   the coin flips. Cash sales are spread evenly through the round so the
   sandbox order list reads like a real till. */
export function planRoundTenders(count: number, mode: RoundTenderMode): TenderChoice[] {
  if (count <= 0) return [];
  if (mode !== "mix") return Array.from({ length: count }, () => mode);
  const cash = Math.min(count, Math.max(1, Math.round(count * MIX_CASH_SHARE)));
  const step = count / cash;
  const cashAt = new Set(
    Array.from({ length: cash }, (_, i) => Math.min(count - 1, Math.floor(i * step + step / 2)))
  );
  return Array.from({ length: count }, (_, i) => (cashAt.has(i) ? "cash" : "card"));
}
