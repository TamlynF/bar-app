"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployeeId } from "@/lib/current-employee";
import { squareClient } from "@/lib/square";
import type { Square } from "square";
import { proposeMappings, type CatalogVariation } from "@/lib/market/mapping";
import { resolveMarketConfig, DEFAULT_MARKET_CONFIG } from "@/lib/market/types";
import {
  buildCatalogUpsertPlan,
  variationIdsFromMappings,
  type ExistingCatalog,
  type MenuPushItem,
} from "@/lib/market/square-push";
import { normaliseName } from "@/lib/menu-import";
import { randomUUID } from "crypto";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

const MARKET_PATHS = ["/settings/market", "/market", "/market/board"] as const;

function revalidateMarket() {
  for (const path of MARKET_PATHS) revalidatePath(path);
}

const configSchema = z.object({
  tickIntervalSec: z.coerce.number().min(15).max(600),
  noiseSigma: z.coerce.number().min(0.001).max(0.2),
  floorPct: z.coerce.number().min(0.1).max(1),
  ceilPct: z.coerce.number().min(1).max(5),
  moveNotifyPct: z.coerce.number().min(0.01).max(0.5),
  lowStockThreshold: z.coerce.number().min(1).max(100),
});

function readConfig(formData: FormData) {
  const parsed = configSchema.safeParse({
    tickIntervalSec: formData.get("tickIntervalSec"),
    noiseSigma: formData.get("noiseSigma"),
    floorPct: formData.get("floorPct"),
    ceilPct: formData.get("ceilPct"),
    moveNotifyPct: formData.get("moveNotifyPct"),
    lowStockThreshold: formData.get("lowStockThreshold"),
  });
  if (!parsed.success) return null;
  return { ...DEFAULT_MARKET_CONFIG, ...parsed.data };
}

type PriceRow = {
  id: number;
  serve: string;
  amount: number | string;
  display_order: number;
  square_variation_id: string | null;
};

type ItemRow = {
  id: number;
  name: string;
  is_active: boolean;
  category_id: number;
  menu_item_prices: PriceRow[];
};

function primaryPrice(item: ItemRow): PriceRow | null {
  const priced = item.menu_item_prices
    .filter((price) => Number(price.amount) > 0)
    .sort((a, b) => a.display_order - b.display_order || a.id - b.id);
  return priced[0] ?? null;
}

export async function startMarketAction(formData: FormData) {
  const supabase = await createClient();

  const config = readConfig(formData);
  if (!config) return { error: "Check the market settings - every number needs a sensible value." };

  let categoryIds: number[];
  try {
    const raw = JSON.parse(formData.get("category_ids")?.toString() || "[]");
    categoryIds = Array.isArray(raw) ? raw.map(Number).filter(Number.isFinite) : [];
  } catch {
    categoryIds = [];
  }
  if (categoryIds.length === 0) return { error: "Pick at least one category to trade." };

  const { data: existing } = await supabase
    .from("market_sessions")
    .select("id")
    .eq("status", "live")
    .maybeSingle();
  if (existing) return { error: "A market is already live - end it before starting another." };

  const { data: items, error: itemsError } = await supabase
    .from("menu_items")
    .select(
      "id, name, is_active, category_id, menu_item_prices(id, serve, amount, display_order, square_variation_id)"
    )
    .eq("is_active", true)
    .in("category_id", categoryIds);
  if (itemsError) return { error: itemsError.message };

  const instruments = ((items ?? []) as ItemRow[])
    .map((item) => ({ item, price: primaryPrice(item) }))
    .filter((entry): entry is { item: ItemRow; price: PriceRow } => entry.price !== null);
  if (instruments.length === 0) {
    return { error: "No items in those categories have a numeric price to trade." };
  }

  const currentEmployeeId = await getCurrentEmployeeId(supabase);
  const now = new Date().toISOString();

  const { data: session, error: sessionError } = await supabase
    .from("market_sessions")
    .insert({
      status: "live",
      config,
      started_at: now,
      orders_watermark: now,
      created_by: currentEmployeeId,
    })
    .select("id")
    .single();
  if (sessionError || !session) {
    return { error: sessionError?.message ?? "Could not open the market." };
  }

  const instrumentRows = instruments.map(({ item, price }) => ({
    session_id: session.id,
    menu_item_price_id: price.id,
    menu_item_id: item.id,
    display_name: item.name,
    serve: price.serve,
    base_price: Number(price.amount),
    opening_price: Number(price.amount),
    current_price: Number(price.amount),
    last_notified_price: Number(price.amount),
    square_variation_id: price.square_variation_id,
  }));

  const { data: inserted, error: instrumentError } = await supabase
    .from("market_instruments")
    .insert(instrumentRows)
    .select("id, current_price");
  if (instrumentError) {
    await supabase.from("market_sessions").delete().eq("id", session.id);
    return { error: instrumentError.message };
  }

  await supabase.from("market_ticks").insert(
    (inserted ?? []).map((row) => ({
      session_id: session.id,
      instrument_id: row.id,
      tick_no: 0,
      price: Number(row.current_price),
    }))
  );

  revalidateMarket();
  return { success: true, count: instrumentRows.length };
}

export async function updateConfigAction(formData: FormData) {
  const supabase = await createClient();
  const config = readConfig(formData);
  if (!config) return { error: "Check the market settings - every number needs a sensible value." };

  const { error } = await supabase
    .from("market_sessions")
    .update({ config })
    .eq("status", "live");
  if (error) return { error: error.message };
  revalidateMarket();
  return { success: true };
}

export async function endMarketAction() {
  const supabase = await createClient();
  const { error } = await supabase
    .from("market_sessions")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("status", "live");
  if (error) return { error: error.message };
  revalidateMarket();
  return { success: true };
}

export async function crashMarketAction() {
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("market_sessions")
    .select("id, tick_no, config")
    .eq("status", "live")
    .maybeSingle();
  if (!session) return { error: "No live market to crash." };

  const config = resolveMarketConfig(session.config);
  const { error } = await supabase
    .from("market_sessions")
    .update({ crash_until_tick: session.tick_no + config.crashDurationTicks })
    .eq("id", session.id);
  if (error) return { error: error.message };

  await supabase.from("market_events").insert({
    session_id: session.id,
    kind: "crash",
    payload: {},
  });

  revalidateMarket();
  return { success: true };
}

export async function setStockOverrideAction(instrumentId: number, value: string) {
  const supabase = await createClient();
  const override = value === "ok" || value === "low" || value === "out" ? value : null;
  const { error } = await supabase
    .from("market_instruments")
    .update({ stock_override: override })
    .eq("id", instrumentId);
  if (error) return { error: error.message };
  revalidateMarket();
  return { success: true };
}

async function fetchCatalogVariations(): Promise<CatalogVariation[]> {
  const variations: CatalogVariation[] = [];
  const page = await squareClient.catalog.list({ types: "ITEM" });
  for await (const obj of page) {
    if (obj.type !== "ITEM" || !obj.itemData?.name) continue;
    for (const variation of obj.itemData.variations ?? []) {
      if (variation.type !== "ITEM_VARIATION" || !variation.id) continue;
      variations.push({
        variationId: variation.id,
        itemName: obj.itemData.name,
        variationName: variation.itemVariationData?.name ?? "",
      });
    }
  }
  return variations;
}

/* Mappings snapshot into market_instruments when a session opens, so a link
   saved mid-session has to be pushed onto the live instruments too or the
   drink would trade demand-blind until the next market night. */
async function syncMappingsToLiveSession(
  supabase: ServerClient,
  byPriceId: Map<number, string | null>
) {
  const { data: session } = await supabase
    .from("market_sessions")
    .select("id")
    .eq("status", "live")
    .maybeSingle();
  if (!session) return;
  for (const [menuItemPriceId, variationId] of byPriceId) {
    await supabase
      .from("market_instruments")
      .update({ square_variation_id: variationId })
      .eq("session_id", session.id)
      .eq("menu_item_price_id", menuItemPriceId);
  }
}

export async function loadCatalogVariationsAction() {
  try {
    const variations = await fetchCatalogVariations();
    return { variations };
  } catch (err) {
    console.error("[market] catalog fetch failed:", err);
    return { error: "Could not reach the Square catalog. Check the Square configuration." };
  }
}

export async function autoMatchMappingsAction() {
  const supabase = await createClient();

  const { data: items, error: itemsError } = await supabase
    .from("menu_items")
    .select("id, name, is_active, menu_item_prices(id, serve, amount, display_order, square_variation_id)")
    .eq("is_active", true);
  if (itemsError) return { error: itemsError.message };

  let variations: CatalogVariation[];
  try {
    variations = await fetchCatalogVariations();
  } catch (err) {
    console.error("[market] catalog fetch failed:", err);
    return { error: "Could not reach the Square catalog. Check the Square configuration." };
  }

  const targets = ((items ?? []) as { id: number; name: string; menu_item_prices: PriceRow[] }[])
    .flatMap((item) =>
      item.menu_item_prices
        .filter((price) => !price.square_variation_id)
        .map((price) => ({
          menuItemPriceId: price.id,
          itemName: item.name,
          serve: price.serve,
          servesOnItem: item.menu_item_prices.length,
        }))
    );

  const proposals = proposeMappings(variations, targets);
  for (const [menuItemPriceId, variationId] of proposals) {
    const { error } = await supabase
      .from("menu_item_prices")
      .update({ square_variation_id: variationId })
      .eq("id", menuItemPriceId);
    if (error) return { error: error.message };
  }
  await syncMappingsToLiveSession(supabase, new Map(proposals));

  revalidateMarket();
  return { success: true, matched: proposals.size, unmatched: targets.length - proposals.size };
}

export async function saveMappingAction(menuItemPriceId: number, variationId: string | null) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("menu_item_prices")
    .update({ square_variation_id: variationId })
    .eq("id", menuItemPriceId);
  if (error) return { error: error.message };
  await syncMappingsToLiveSession(supabase, new Map([[menuItemPriceId, variationId]]));
  revalidateMarket();
  return { success: true };
}

type PushItemRow = {
  id: number;
  name: string;
  menu_categories: { name: string } | { name: string }[] | null;
  menu_item_prices: PriceRow[];
};

async function fetchExistingCatalog(): Promise<ExistingCatalog> {
  const itemNames = new Set<string>();
  const categoryIdsByName = new Map<string, string>();
  const page = await squareClient.catalog.list({ types: "ITEM,CATEGORY" });
  for await (const obj of page) {
    if (obj.type === "ITEM" && obj.itemData?.name) {
      itemNames.add(normaliseName(obj.itemData.name));
    } else if (obj.type === "CATEGORY" && obj.id && obj.categoryData?.name) {
      const key = normaliseName(obj.categoryData.name);
      if (!categoryIdsByName.has(key)) categoryIdsByName.set(key, obj.id);
    }
  }
  return { itemNames, categoryIdsByName };
}

export async function pushMenuToSquareAction() {
  const supabase = await createClient();

  const { data: items, error: itemsError } = await supabase
    .from("menu_items")
    .select(
      "id, name, menu_categories(name), menu_item_prices(id, serve, amount, display_order, square_variation_id)"
    )
    .eq("is_active", true);
  if (itemsError) return { error: itemsError.message };

  const pushItems: MenuPushItem[] = ((items ?? []) as PushItemRow[]).map((item) => {
    const category = Array.isArray(item.menu_categories)
      ? item.menu_categories[0]
      : item.menu_categories;
    return {
      menuItemId: item.id,
      name: item.name,
      categoryName: category?.name ?? "",
      prices: [...item.menu_item_prices]
        .sort((a, b) => a.display_order - b.display_order || a.id - b.id)
        .map((price) => ({
          priceId: price.id,
          serve: price.serve,
          amount: Number(price.amount),
        })),
    };
  });

  try {
    const existing = await fetchExistingCatalog();
    const plan = buildCatalogUpsertPlan(pushItems, existing, normaliseName);
    if (plan.objects.length === 0) {
      return {
        success: true,
        created: 0,
        skipped: plan.skippedItemNames.length,
        linked: 0,
      };
    }

    const response = await squareClient.catalog.batchUpsert({
      idempotencyKey: randomUUID(),
      batches: [{ objects: plan.objects as Square.CatalogObject[] }],
    });

    const variationIds = variationIdsFromMappings(
      response.idMappings ?? [],
      plan.priceIdByTempVariationId
    );
    for (const [menuItemPriceId, variationId] of variationIds) {
      const { error } = await supabase
        .from("menu_item_prices")
        .update({ square_variation_id: variationId })
        .eq("id", menuItemPriceId);
      if (error) return { error: error.message };
    }
    await syncMappingsToLiveSession(supabase, new Map(variationIds));

    revalidateMarket();
    return {
      success: true,
      created: plan.createdItemCount,
      skipped: plan.skippedItemNames.length,
      linked: variationIds.size,
    };
  } catch (err) {
    console.error("[market] push to Square failed:", err);
    return { error: "Sending the menu to Square failed. Check the Square configuration." };
  }
}
