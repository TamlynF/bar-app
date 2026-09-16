import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Square } from "square";
import { squareClient } from "@/lib/square";

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
};

export type SeedResult = { seeded: number; stocked: number };

/* One ITEM + one ITEM_VARIATION per instrument, priced at the base (menu)
   price so the first market tick visibly moves it. Variation ids are written
   to market_instruments only, and square_original_price is set to the seeded
   price so ending the market restores the sandbox catalog too. */
export async function seedSandboxCatalog(
  supabase: SupabaseClient,
  sessionId: number,
  stockQty: number
): Promise<SeedResult | { error: string }> {
  const guard = assertSandbox();
  if ("error" in guard) return guard;
  const { locationId } = guard;

  const { data, error } = await supabase
    .from("market_instruments")
    .select("id, display_name, serve, base_price, opening_price")
    .eq("session_id", sessionId);
  if (error) return { error: error.message };
  const rows = (data ?? []) as SeedRow[];
  if (rows.length === 0) return { error: "No drinks on the live market to seed." };

  const objects: Square.CatalogObject[] = rows.map((row) => {
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

  const res = await squareClient.catalog.batchUpsert({
    idempotencyKey: randomUUID(),
    batches: [{ objects }],
  });

  const priceById = new Map(rows.map((row) => [row.id, Number(row.base_price)]));
  const variationIds: { instrumentId: number; variationId: string }[] = [];
  for (const mapping of res.idMappings ?? []) {
    const match = mapping.clientObjectId?.match(/^#var-(\d+)$/);
    if (!match || !mapping.objectId) continue;
    variationIds.push({ instrumentId: Number(match[1]), variationId: mapping.objectId });
  }

  for (const { instrumentId, variationId } of variationIds) {
    const { error: writeError } = await supabase
      .from("market_instruments")
      .update({
        square_variation_id: variationId,
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

  return { seeded: variationIds.length, stocked };
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
  tender: "card" | "cash";
};

/* Exactly what the POS does: an order with catalog line items, then a payment
   that autocompletes. An order with no fulfilment flips to COMPLETED the moment
   it is fully paid, which is the state tick.ts polls for. */
export async function ringSaleThroughSquare(
  locationId: string,
  lines: SaleLine[],
  tender: "card" | "cash"
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
