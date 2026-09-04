"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployeeId } from "@/lib/current-employee";
import { squareClient } from "@/lib/square";
import type { Square } from "square";
import { proposeMappings, type CatalogVariation } from "@/lib/market/mapping";
import { resolveMarketConfig, DEFAULT_MARKET_CONFIG, type MarketConfig } from "@/lib/market/types";
import { eventConfig, type StockMarketEventRow } from "@/lib/market/stock-market-events";
import {
  EMPTY_OVERRIDES,
  overridesFromRow,
  overridesToRow,
  type DrinkOverrideRow,
  type DrinkOverrides,
} from "@/lib/market/drink-overrides";
import {
  buildCatalogUpsertPlan,
  variationIdsFromMappings,
  type ExistingCatalog,
  type MenuPushItem,
} from "@/lib/market/square-push";
import { normaliseName } from "@/lib/menu-import";
import { randomUUID } from "crypto";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

const MARKET_PATHS = ["/market", "/market/board"] as const;

function revalidateMarket() {
  revalidatePath("/settings/market", "layout");
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

async function openSession(
  supabase: ServerClient,
  options: {
    config: MarketConfig;
    menuItemIds: number[];
    overridesByItem: Map<number, DrinkOverrides>;
    stockMarketEventId: number;
  }
) {
  const { data: existing } = await supabase
    .from("market_sessions")
    .select("id")
    .eq("status", "live")
    .maybeSingle();
  if (existing) return { error: "A market is already live - close it before opening another." };

  const { data: items, error: itemsError } = await supabase
    .from("menu_items")
    .select(
      "id, name, is_active, category_id, menu_item_prices(id, serve, amount, display_order, square_variation_id)"
    )
    .eq("is_active", true)
    .in("id", options.menuItemIds);
  if (itemsError) return { error: itemsError.message };

  const instruments = ((items ?? []) as ItemRow[])
    .map((item) => ({ item, price: primaryPrice(item) }))
    .filter((entry): entry is { item: ItemRow; price: PriceRow } => entry.price !== null);
  if (instruments.length === 0) {
    return { error: "None of the drinks on this event have a numeric price to trade." };
  }

  const currentEmployeeId = await getCurrentEmployeeId(supabase);
  const now = new Date().toISOString();

  const { data: session, error: sessionError } = await supabase
    .from("market_sessions")
    .insert({
      status: "live",
      config: options.config,
      started_at: now,
      orders_watermark: now,
      created_by: currentEmployeeId,
      stock_market_event_id: options.stockMarketEventId,
    })
    .select("id")
    .single();
  if (sessionError || !session) {
    return { error: sessionError?.message ?? "Could not open the market." };
  }

  const instrumentRows = instruments.map(({ item, price }) => {
    const overrides = options.overridesByItem.get(item.id) ?? EMPTY_OVERRIDES;
    const opening = overrides.openingPrice ?? Number(price.amount);
    return {
      session_id: session.id,
      menu_item_price_id: price.id,
      menu_item_id: item.id,
      display_name: item.name,
      serve: price.serve,
      base_price: Number(price.amount),
      opening_price: opening,
      current_price: opening,
      last_notified_price: opening,
      square_variation_id: price.square_variation_id,
      min_price: overrides.minPrice,
      max_price: overrides.maxPrice,
      crash_price: overrides.crashPrice,
      low_stock_at: overrides.lowStockAt,
      alert_threshold: overrides.alertThreshold,
    };
  });

  const { data: inserted, error: instrumentError } = await supabase
    .from("market_instruments")
    .insert(instrumentRows)
    .select("id, current_price");
  if (instrumentError) {
    await supabase.from("market_sessions").delete().eq("id", session.id);
    return { error: instrumentError.message };
  }

  const { error: tickError } = await supabase.from("market_ticks").insert(
    (inserted ?? []).map((row) => ({
      session_id: session.id,
      instrument_id: row.id,
      tick_no: 0,
      price: Number(row.current_price),
    }))
  );
  if (tickError) console.error("[market] opening tick insert failed:", tickError);

  return { success: true, count: instrumentRows.length };
}

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

const eventSchema = configSchema.extend({
  name: z.string().trim().min(1, "Name is required.").max(80),
  open_time: z.string().regex(CLOCK, "Opening time is required."),
  close_time: z.string().regex(CLOCK, "Closing time is required."),
});

function readMenuItemIds(formData: FormData): number[] {
  try {
    const raw = JSON.parse(formData.get("menu_item_ids")?.toString() || "[]");
    return Array.isArray(raw)
      ? [...new Set(raw.map(Number).filter((id) => Number.isInteger(id) && id > 0))]
      : [];
  } catch {
    return [];
  }
}

export async function saveStockMarketEventAction(formData: FormData) {
  const supabase = await createClient();

  const parsed = eventSchema.safeParse({
    name: formData.get("name"),
    open_time: formData.get("open_time"),
    close_time: formData.get("close_time"),
    tickIntervalSec: formData.get("tickIntervalSec"),
    noiseSigma: formData.get("noiseSigma"),
    floorPct: formData.get("floorPct"),
    ceilPct: formData.get("ceilPct"),
    moveNotifyPct: formData.get("moveNotifyPct"),
    lowStockThreshold: formData.get("lowStockThreshold"),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const configKeys = Object.keys(configSchema.shape);
    const message = configKeys.includes(String(issue?.path[0]))
      ? "Check the market settings - every number needs a sensible value."
      : (issue?.message ?? "Check the event details.");
    return { error: message };
  }

  const menuItemIds = readMenuItemIds(formData);
  if (menuItemIds.length === 0) return { error: "Pick at least one drink for this event." };

  const idRaw = formData.get("id")?.toString();
  const id = idRaw ? Number(idRaw) : null;
  const currentEmployeeId = await getCurrentEmployeeId(supabase);
  const values = parsed.data;
  const payload = {
    name: values.name,
    open_time: values.open_time,
    close_time: values.close_time,
    tick_interval_sec: values.tickIntervalSec,
    noise_sigma: values.noiseSigma,
    floor_pct: values.floorPct,
    ceil_pct: values.ceilPct,
    move_notify_pct: values.moveNotifyPct,
    low_stock_threshold: values.lowStockThreshold,
  };

  let eventId: number;
  if (id && Number.isFinite(id)) {
    const { error } = await supabase
      .from("stock_market_events")
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
        updated_by: currentEmployeeId,
      })
      .eq("id", id);
    if (error) return { error: error.message };
    eventId = id;
  } else {
    const { data, error } = await supabase
      .from("stock_market_events")
      .insert({ ...payload, created_by: currentEmployeeId, updated_by: currentEmployeeId })
      .select("id")
      .single();
    if (error || !data) return { error: error?.message ?? "Could not save the event." };
    eventId = data.id;
  }

  const nightOnlyIds = await nightOnlyItemIds(supabase, eventId);
  const keep = [...new Set([...menuItemIds, ...nightOnlyIds])];
  const { data: existingItems, error: existingError } = await supabase
    .from("stock_market_event_items")
    .select("menu_item_id")
    .eq("event_id", eventId);
  if (existingError) return { error: existingError.message };
  const keepSet = new Set(keep);
  const dropped = (existingItems ?? [])
    .map((item) => item.menu_item_id as number)
    .filter((menuItemId) => !keepSet.has(menuItemId));
  if (dropped.length > 0) {
    const { error: clearError } = await supabase
      .from("stock_market_event_items")
      .delete()
      .eq("event_id", eventId)
      .in("menu_item_id", dropped);
    if (clearError) return { error: clearError.message };
  }
  const { error: itemsError } = await supabase
    .from("stock_market_event_items")
    .upsert(
      keep.map((menuItemId) => ({ event_id: eventId, menu_item_id: menuItemId })),
      { onConflict: "event_id,menu_item_id", ignoreDuplicates: true }
    );
  if (itemsError) return { error: itemsError.message };

  revalidateMarket();
  return { success: true, id: eventId };
}

export async function deactivateStockMarketEventAction(id: number) {
  const supabase = await createClient();
  const { data: live } = await supabase
    .from("market_sessions")
    .select("id")
    .eq("status", "live")
    .eq("stock_market_event_id", id)
    .maybeSingle();
  if (live) return { error: "This event's market is live - close it before deactivating." };

  const currentEmployeeId = await getCurrentEmployeeId(supabase);
  const { error } = await supabase
    .from("stock_market_events")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
      updated_by: currentEmployeeId,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidateMarket();
  return { success: true };
}

export async function openStockMarketEventAction(id: number) {
  const supabase = await createClient();
  const { data: event, error } = await supabase
    .from("stock_market_events")
    .select(
      "*, stock_market_event_items(menu_item_id, opening_price, min_price, max_price, crash_price, low_stock_at, alert_threshold)"
    )
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!event) return { error: "That event is no longer available." };

  const row = event as StockMarketEventRow & {
    stock_market_event_items: ({ menu_item_id: number } & DrinkOverrideRow)[] | null;
  };
  const items = row.stock_market_event_items ?? [];
  const menuItemIds = items.map((item) => item.menu_item_id);
  if (menuItemIds.length === 0) return { error: "This event has no drinks - edit it and pick some." };

  const result = await openSession(supabase, {
    config: eventConfig(row),
    menuItemIds,
    overridesByItem: new Map(items.map((item) => [item.menu_item_id, overridesFromRow(item)])),
    stockMarketEventId: row.id,
  });
  if ("error" in result) return result;
  revalidateMarket();
  return result;
}

type EventItemJoin = {
  menu_item_id: number;
  menu_items:
    | { menu_categories: { market_only: boolean } | { market_only: boolean }[] | null }
    | { menu_categories: { market_only: boolean } | { market_only: boolean }[] | null }[]
    | null;
};

function isMarketOnlyJoin(row: EventItemJoin): boolean {
  const item = Array.isArray(row.menu_items) ? row.menu_items[0] : row.menu_items;
  const raw = item?.menu_categories;
  const category = Array.isArray(raw) ? raw[0] : raw;
  return Boolean(category?.market_only);
}

async function nightOnlyItemIds(supabase: ServerClient, eventId: number): Promise<number[]> {
  const { data } = await supabase
    .from("stock_market_event_items")
    .select("menu_item_id, menu_items(menu_categories(market_only))")
    .eq("event_id", eventId);
  return ((data ?? []) as EventItemJoin[])
    .filter(isMarketOnlyJoin)
    .map((row) => row.menu_item_id);
}

async function ensureMarketOnlyCategory(supabase: ServerClient): Promise<number | { error: string }> {
  const { data: existing } = await supabase
    .from("menu_categories")
    .select("id")
    .eq("market_only", true)
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await supabase
    .from("menu_categories")
    .insert({
      name: "Market night specials",
      is_active: false,
      market_only: true,
      display_order: 999,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not create the market night category." };
  return data.id;
}

async function eventExists(supabase: ServerClient, eventId: number): Promise<boolean> {
  const { data } = await supabase
    .from("stock_market_events")
    .select("id")
    .eq("id", eventId)
    .eq("is_active", true)
    .maybeSingle();
  return Boolean(data);
}

export async function addEventDrinksAction(eventId: number, menuItemIds: number[]) {
  const supabase = await createClient();
  const ids = [...new Set(menuItemIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (ids.length === 0) return { error: "Pick at least one drink to add." };
  if (!(await eventExists(supabase, eventId))) return { error: "That event is no longer available." };

  const { error } = await supabase
    .from("stock_market_event_items")
    .upsert(
      ids.map((menuItemId) => ({ event_id: eventId, menu_item_id: menuItemId })),
      { onConflict: "event_id,menu_item_id", ignoreDuplicates: true }
    );
  if (error) return { error: error.message };
  revalidateMarket();
  return { success: true, count: ids.length };
}

export async function removeEventDrinkAction(eventId: number, menuItemId: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("stock_market_event_items")
    .delete()
    .eq("event_id", eventId)
    .eq("menu_item_id", menuItemId);
  if (error) return { error: error.message };

  const { data: item } = await supabase
    .from("menu_items")
    .select("id, menu_categories(market_only)")
    .eq("id", menuItemId)
    .maybeSingle();
  const category = item
    ? Array.isArray(item.menu_categories)
      ? item.menu_categories[0]
      : item.menu_categories
    : null;
  if (category?.market_only) {
    const { count } = await supabase
      .from("stock_market_event_items")
      .select("event_id", { count: "exact", head: true })
      .eq("menu_item_id", menuItemId);
    if (!count) {
      const { error: deleteError } = await supabase.from("menu_items").delete().eq("id", menuItemId);
      if (deleteError) return { error: deleteError.message };
    }
  }

  revalidateMarket();
  return { success: true };
}

const nightDrinkSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(80),
  serve: z.string().trim().min(1, "Serve is required.").max(40),
  amount: z.coerce.number().positive("Price must be more than zero.").max(9999),
});

const optionalMoney = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? null : value),
  z.coerce.number().positive("Prices must be more than zero.").max(9999).nullable()
);

const drinkOverridesSchema = z
  .object({
    openingPrice: optionalMoney,
    minPrice: optionalMoney,
    maxPrice: optionalMoney,
    crashPrice: optionalMoney,
    lowStockAt: z.preprocess(
      (value) => (value === "" || value === null || value === undefined ? null : value),
      z.coerce.number().int("Low stock at must be a whole number.").min(0).max(1000).nullable()
    ),
    alertThreshold: z.preprocess(
      (value) => (value === "" || value === null || value === undefined ? null : value),
      z.coerce
        .number()
        .min(0.01, "Alert threshold must be at least 0.01.")
        .max(0.5, "Alert threshold must be 0.5 or less.")
        .nullable()
    ),
  })
  .refine(
    (values) => values.minPrice == null || values.maxPrice == null || values.minPrice <= values.maxPrice,
    { message: "Min price must not be above max price.", path: ["minPrice"] }
  );

function readDrinkOverrides(formData: FormData): DrinkOverrides | { error: string } {
  const parsed = drinkOverridesSchema.safeParse({
    openingPrice: formData.get("opening_price"),
    minPrice: formData.get("min_price"),
    maxPrice: formData.get("max_price"),
    crashPrice: formData.get("crash_price"),
    lowStockAt: formData.get("low_stock_at"),
    alertThreshold: formData.get("alert_threshold"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the pricing overrides." };
  }
  return parsed.data;
}

async function writeDrinkOverrides(
  supabase: ServerClient,
  eventId: number,
  menuItemId: number,
  overrides: DrinkOverrides
): Promise<{ error: string } | null> {
  const { error } = await supabase
    .from("stock_market_event_items")
    .upsert(
      { event_id: eventId, menu_item_id: menuItemId, ...overridesToRow(overrides) },
      { onConflict: "event_id,menu_item_id" }
    );
  return error ? { error: error.message } : null;
}

export async function saveEventDrinkPricingAction(formData: FormData) {
  const supabase = await createClient();
  const eventId = Number(formData.get("event_id"));
  const menuItemId = Number(formData.get("id"));
  if (!Number.isInteger(eventId) || eventId <= 0) return { error: "Missing event." };
  if (!Number.isInteger(menuItemId) || menuItemId <= 0) return { error: "Missing drink." };
  if (!(await eventExists(supabase, eventId))) return { error: "That event is no longer available." };

  const overrides = readDrinkOverrides(formData);
  if ("error" in overrides) return overrides;

  const writeError = await writeDrinkOverrides(supabase, eventId, menuItemId, overrides);
  if (writeError) return writeError;
  revalidateMarket();
  return { success: true, id: menuItemId };
}

export async function saveNightOnlyDrinkAction(formData: FormData) {
  const supabase = await createClient();
  const eventId = Number(formData.get("event_id"));
  if (!Number.isInteger(eventId) || eventId <= 0) return { error: "Missing event." };
  if (!(await eventExists(supabase, eventId))) return { error: "That event is no longer available." };

  const parsed = nightDrinkSchema.safeParse({
    name: formData.get("name"),
    serve: formData.get("serve"),
    amount: formData.get("amount"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the drink details." };
  }
  const { name, serve, amount } = parsed.data;
  const overrides = readDrinkOverrides(formData);
  if ("error" in overrides) return overrides;
  const idRaw = formData.get("id")?.toString();
  const id = idRaw ? Number(idRaw) : null;
  const currentEmployeeId = await getCurrentEmployeeId(supabase);
  const now = new Date().toISOString();
  const priceText = `£${amount.toFixed(2)}`;

  if (id && Number.isFinite(id)) {
    const { data: item } = await supabase
      .from("menu_items")
      .select("id, menu_categories(market_only)")
      .eq("id", id)
      .maybeSingle();
    const category = item
      ? Array.isArray(item.menu_categories)
        ? item.menu_categories[0]
        : item.menu_categories
      : null;
    if (!item || !category?.market_only) {
      return { error: "Only drinks created for a market night can be edited here." };
    }
    const { error } = await supabase
      .from("menu_items")
      .update({ name, price: priceText, updated_at: now, updated_by: currentEmployeeId })
      .eq("id", id);
    if (error) return { error: error.message };

    const { data: price } = await supabase
      .from("menu_item_prices")
      .select("id")
      .eq("menu_item_id", id)
      .order("display_order", { ascending: true })
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();
    const priceWrite = price
      ? supabase
          .from("menu_item_prices")
          .update({ serve, amount, updated_at: now, updated_by: currentEmployeeId })
          .eq("id", price.id)
      : supabase.from("menu_item_prices").insert({
          menu_item_id: id,
          serve,
          amount,
          display_order: 0,
          created_by: currentEmployeeId,
          updated_by: currentEmployeeId,
        });
    const { error: priceError } = await priceWrite;
    if (priceError) return { error: priceError.message };

    const overrideError = await writeDrinkOverrides(supabase, eventId, id, overrides);
    if (overrideError) return overrideError;

    revalidateMarket();
    return { success: true, id };
  }

  const categoryId = await ensureMarketOnlyCategory(supabase);
  if (typeof categoryId !== "number") return categoryId;

  const { data: inserted, error } = await supabase
    .from("menu_items")
    .insert({
      category_id: categoryId,
      name,
      price: priceText,
      display_order: 0,
      is_active: true,
      created_at: now,
      updated_at: now,
      created_by: currentEmployeeId,
      updated_by: currentEmployeeId,
    })
    .select("id")
    .single();
  if (error || !inserted) return { error: error?.message ?? "Could not create the drink." };

  const { error: priceError } = await supabase.from("menu_item_prices").insert({
    menu_item_id: inserted.id,
    serve,
    amount,
    display_order: 0,
    created_by: currentEmployeeId,
    updated_by: currentEmployeeId,
  });
  if (priceError) {
    await supabase.from("menu_items").delete().eq("id", inserted.id);
    return { error: priceError.message };
  }

  const { error: linkError } = await supabase
    .from("stock_market_event_items")
    .insert({ event_id: eventId, menu_item_id: inserted.id, ...overridesToRow(overrides) });
  if (linkError) return { error: linkError.message };

  revalidateMarket();
  return { success: true, id: inserted.id };
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

export async function crashInstrumentAction(instrumentId: number) {
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("market_sessions")
    .select("id, tick_no, config")
    .eq("status", "live")
    .maybeSingle();
  if (!session) return { error: "No live market to crash." };

  const { data: instrument } = await supabase
    .from("market_instruments")
    .select("id, display_name, serve")
    .eq("id", instrumentId)
    .eq("session_id", session.id)
    .maybeSingle();
  if (!instrument) return { error: "That drink is not trading on the live market." };

  const config = resolveMarketConfig(session.config);
  const { error } = await supabase
    .from("market_instruments")
    .update({ crash_until_tick: session.tick_no + config.crashDurationTicks })
    .eq("id", instrument.id);
  if (error) return { error: error.message };

  await supabase.from("market_events").insert({
    session_id: session.id,
    instrument_id: instrument.id,
    kind: "crash",
    payload: { name: instrument.display_name, serve: instrument.serve },
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
