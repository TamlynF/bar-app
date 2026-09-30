import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Square } from "square";
import { squareClient } from "@/lib/square";
import type { SeedMode } from "./types";
import { isStockTrackedAt, refreshStockTracking } from "./square-stock-tracking";
import { readMixerChoice, refreshSessionMixers } from "./square-mixers";
import { isMixerList, type MixerChoice } from "./mixer";
import { resolveMarketConfig } from "./types";

export type { SeedMode };

/* Demo path for staff: the live market's drinks are seeded into the Square
   SANDBOX catalog (session-scoped - menu_item_prices is never touched), and a
   "sale" is a real CreateOrder + CreatePayment there. tick.ts then finds the
   order through orders.search exactly as it would a till sale, and the price
   sync writes the new price back into the sandbox catalog, so the whole loop
   is visible in the Square sandbox dashboard. Refuses to run in production. */

const CURRENCY: Square.Currency = "GBP";

/* Temp items carry the drink's real name, so nothing in the catalog tells them
   apart from the menu's own items. They go in a category of their own instead,
   which makes cleanup exact rather than guessed at - and shows the demo items
   as their own section in the Square dashboard. */
export const DEMO_CATEGORY_NAME = "Market demo (temporary)";

async function findDemoCategoryId(): Promise<string | null> {
  const page = await squareClient.catalog.list({ types: "CATEGORY" });
  for await (const obj of page) {
    if (obj.type === "CATEGORY" && obj.id && obj.categoryData?.name === DEMO_CATEGORY_NAME) {
      return obj.id;
    }
  }
  return null;
}

/* Looked up before it is created, so repeated seeds share one category instead
   of leaving a trail of them. A failure here is never fatal: the seed goes on
   without the tag and the items are still findable by name. */
export async function ensureDemoCategory(): Promise<string | null> {
  try {
    const existing = await findDemoCategoryId();
    if (existing) return existing;
    const res = await squareClient.catalog.batchUpsert({
      idempotencyKey: randomUUID(),
      batches: [
        {
          objects: [
            {
              type: "CATEGORY",
              id: "#market-demo-category",
              presentAtAllLocations: true,
              categoryData: { name: DEMO_CATEGORY_NAME },
            },
          ],
        },
      ],
    });
    return res.objects?.[0]?.id ?? res.idMappings?.[0]?.objectId ?? null;
  } catch (err) {
    console.error("[market] demo category upsert failed:", err);
    return null;
  }
}

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
  is_alcoholic?: boolean;
  mixer_price?: number | string | null;
};

export type SeedResult = {
  seeded: number;
  stocked: number;
  created: number;
  reused: number;
  deleted: number;
  mixersAttached: number;
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
      "*, menu_item_prices(square_variation_id), menu_items(menu_categories(*))"
    )
    .eq("session_id", sessionId);
  if (error) return { error: error.message };
  const rows = (data ?? []).map((raw) => {
    type CategoryJoin = { is_alcoholic: boolean | null } | { is_alcoholic: boolean | null }[] | null;
    type ItemJoin = { menu_categories: CategoryJoin } | { menu_categories: CategoryJoin }[] | null;
    const row = raw as Omit<SeedRow, "menu_variation_id"> & {
      menu_item_prices: { square_variation_id: string | null } | { square_variation_id: string | null }[] | null;
      menu_items: ItemJoin;
    };
    const price = Array.isArray(row.menu_item_prices) ? row.menu_item_prices[0] : row.menu_item_prices;
    const item = Array.isArray(row.menu_items) ? row.menu_items[0] : row.menu_items;
    const category = Array.isArray(item?.menu_categories) ? item.menu_categories[0] : item?.menu_categories;
    return {
      ...row,
      menu_variation_id: price?.square_variation_id ?? null,
      is_alcoholic: Boolean(category?.is_alcoholic),
    } as SeedRow;
  });
  if (rows.length === 0) return { error: "No drinks on the live market to seed." };

  const plan = planSandboxSeed(rows, mode);
  const creating = new Set(
    plan.filter((step) => step.action === "create").map((step) => step.instrumentId)
  );

  const deleted = await deleteSeededItems(itemIdsToDelete(rows, mode));

  const demoCategoryId = creating.size > 0 ? await ensureDemoCategory() : null;

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
          productType: "FOOD_AND_BEV",
          isAlcoholic: Boolean(row.is_alcoholic),
          ...(demoCategoryId
            ? {
                categories: [{ id: demoCategoryId }],
                reportingCategory: { id: demoCategoryId },
              }
            : {}),
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
    await enableStockTracking(
      variationIds.map(({ variationId }) => variationId),
      locationId
    );
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

  const mixerVariationIds = variationIds
    .filter(({ instrumentId }) => {
      const row = rows.find((candidate) => candidate.id === instrumentId);
      return row?.mixer_price != null;
    })
    .map(({ variationId }) => variationId);
  let mixersAttached = 0;
  if (mixerVariationIds.length > 0) {
    try {
      const [choice, { data: session }] = await Promise.all([
        readMixerChoice(supabase),
        supabase.from("market_sessions").select("config").eq("id", sessionId).maybeSingle(),
      ]);
      const listId = await ensureSandboxMixerList(choice, resolveMarketConfig(session?.config).mixerPrice);
      if (listId) mixersAttached = await attachModifierList(mixerVariationIds, listId);
    } catch (err) {
      console.error("[market] could not attach the sandbox mixer list:", err);
    }
  }

  await supabase
    .from("market_sessions")
    .update({ sandbox_seeded_at: new Date().toISOString() })
    .eq("id", sessionId);
  await refreshStockTracking(supabase, sessionId, { requireSquare: false });
  await refreshSessionMixers(supabase, sessionId, { requireSquare: false });

  return {
    seeded: variationIds.length,
    stocked,
    created: createdItemByInstrument.size,
    reused: variationIds.length - createdItemByInstrument.size,
    deleted,
    mixersAttached,
  };
}

/* A previous seed's objects, removed before a fresh one replaces them. Square
   rejects the whole batch if any id has already gone, so a failure here is
   logged and the seed continues - a leftover duplicate is better than a seed
   that cannot run. */
export async function deleteSeededItems(itemIds: string[]): Promise<number> {
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

type Variation = Extract<Square.CatalogObject, { type: "ITEM_VARIATION" }>;
type Item = Extract<Square.CatalogObject, { type: "ITEM" }>;

export const SANDBOX_MIXERS = ["Orange juice", "Tonic water", "Lemonade", "Coke", "Red Bull"];

/* The sandbox's mixer list, so seeded spirits ring up at spirit + mixer like
   the till: the list chosen on Square links, else an existing list with
   "mixer" in its name, else a new "Mixers" list at the event's mixer price.
   Null when mixers are switched off. */
export async function ensureSandboxMixerList(choice: MixerChoice, mixerPrice: number): Promise<string | null> {
  if (choice.mode === "off") return null;
  if (choice.mode === "list") return choice.listId;
  for await (const obj of await squareClient.catalog.list({ types: "MODIFIER_LIST" })) {
    if (obj.type === "MODIFIER_LIST" && obj.id && isMixerList({ id: obj.id, name: obj.modifierListData?.name ?? "" }, choice)) {
      return obj.id;
    }
  }
  const res = await squareClient.catalog.batchUpsert({
    idempotencyKey: randomUUID(),
    batches: [
      {
        objects: [
          {
            type: "MODIFIER_LIST",
            id: "#sandbox-mixers",
            presentAtAllLocations: true,
            modifierListData: {
              name: "Mixers",
              selectionType: "SINGLE",
              modifiers: SANDBOX_MIXERS.map((name, index) => ({
                type: "MODIFIER",
                id: `#sandbox-mixer-${index}`,
                presentAtAllLocations: true,
                modifierData: { name, priceMoney: poundsToMoney(mixerPrice) },
              })),
            },
          },
        ],
      },
    ],
  });
  return res.idMappings?.find((mapping) => mapping.clientObjectId === "#sandbox-mixers")?.objectId ?? null;
}

/* Puts the mixer list on the items behind these variations. An ITEM upsert
   must carry the whole item or Square drops the missing variations, so each
   item is re-read and sent back with only the list added. */
export async function attachModifierList(variationIds: string[], listId: string): Promise<number> {
  const variations = await squareClient.catalog.batchGet({
    objectIds: [...new Set(variationIds)],
    includeRelatedObjects: false,
    includeDeletedObjects: false,
  });
  const itemIds = [
    ...new Set(
      (variations.objects ?? []).flatMap((obj) =>
        obj.type === "ITEM_VARIATION" && obj.itemVariationData?.itemId ? [obj.itemVariationData.itemId] : []
      )
    ),
  ];
  if (itemIds.length === 0) return 0;
  const items = await squareClient.catalog.batchGet({ objectIds: itemIds, includeRelatedObjects: false, includeDeletedObjects: false });
  const changes = (items.objects ?? []).flatMap((obj) => {
    if (obj.type !== "ITEM" || !obj.itemData) return [];
    const item = obj as Item;
    const lists = item.itemData?.modifierListInfo ?? [];
    if (lists.some((info) => info.modifierListId === listId)) return [];
    return [
      {
        ...item,
        itemData: {
          ...item.itemData,
          modifierListInfo: [...lists, { modifierListId: listId, enabled: true, minSelectedModifiers: 1, maxSelectedModifiers: 1 }],
        },
      },
    ];
  });
  for (let i = 0; i < changes.length; i += 10) {
    await squareClient.catalog.batchUpsert({ idempotencyKey: randomUUID(), batches: [{ objects: changes.slice(i, i + 10) }] });
  }
  return changes.length;
}

/* Stock added to a serve Square does not track would be ignored by the
   market, so seeding switches tracking on for every serve it stocks, at the
   variation and at this location. Sandbox only - callers go through
   assertSandbox. */
export async function enableStockTracking(variationIds: string[], locationId: string): Promise<number> {
  if (variationIds.length === 0) return 0;
  const res = await squareClient.catalog.batchGet({
    objectIds: variationIds,
    includeRelatedObjects: false,
    includeDeletedObjects: false,
  });
  const changes = (res.objects ?? []).flatMap((obj) => {
    if (obj.type !== "ITEM_VARIATION" || !obj.itemVariationData) return [];
    const variation = obj as Variation;
    if (isStockTrackedAt(variation.itemVariationData, locationId)) return [];
    return [
      {
        ...variation,
        itemVariationData: {
          ...variation.itemVariationData,
          trackInventory: true,
          locationOverrides: variation.itemVariationData?.locationOverrides?.map((override) =>
            override.locationId === locationId ? { ...override, trackInventory: true } : override
          ),
        },
      },
    ];
  });
  for (let i = 0; i < changes.length; i += 10) {
    await squareClient.catalog.batchUpsert({
      idempotencyKey: randomUUID(),
      batches: [{ objects: changes.slice(i, i + 10) }],
    });
  }
  return changes.length;
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

export type SaleLine = { variationId: string; quantity: number; mixerModifierId?: string | null };
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
        ...(line.mixerModifierId ? { modifiers: [{ catalogObjectId: line.mixerModifierId, quantity: "1" }] } : {}),
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
