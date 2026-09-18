"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployeeId } from "@/lib/current-employee";
import { squareClient } from "@/lib/square";
import type { Square } from "square";
import { proposeMappings, type CatalogVariation } from "@/lib/market/mapping";
import { fetchCatalogVariations } from "@/lib/market/catalog-variations";
import { resolveMarketConfig, DEFAULT_MARKET_CONFIG, type MarketConfig, type PricingMode } from "@/lib/market/types";
import { eventConfig, type StockMarketEventRow } from "@/lib/market/stock-market-events";
import { sessionTicksFor } from "@/lib/market/normal-units";
import { shouldRerank } from "@/lib/market/tier-engine";
import { LIVE_MARKET_MENU_MESSAGE, liveMarketSessionId } from "@/lib/market/live-guard";
import {
  recalculateNormalUnits,
  resolveNormalsForOpen,
  type NormalUnitsEventRow,
  type ResolvedNormals,
} from "@/lib/market/normal-units-server";
import { syncSquareSales } from "@/lib/square-sync";
import {
  EMPTY_OVERRIDES,
  optionalNumber,
  overridesFromRow,
  overridesToRow,
  type DrinkOverrideRow,
  type DrinkOverrides,
} from "@/lib/market/drink-overrides";
import {
  captureSquareOriginalPrices,
  restoreSquarePrices,
} from "@/lib/market/square-price-sync";
import {
  buildCatalogUpsertPlan,
  variationIdsFromMappings,
  type ExistingCatalog,
  type MenuPushItem,
} from "@/lib/market/square-push";
import { normaliseName } from "@/lib/menu-import";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { maybeRunMarketTick, type MarketSessionRow } from "@/lib/market/tick";
import {
  isValidSaleUnits,
  planBusyRound,
  SIM_MAX_ROUND_SALES,
  SIM_MAX_UNITS_PER_SALE,
  SIM_MAX_SQUARE_ROUND_SALES,
  squareItemUrl,
} from "@/lib/market/simulate";
import { SQUARE_ITEM_MAP_TAG } from "@/lib/market/square-item-links";
import {
  addInventory,
  assertSandbox,
  deleteSeededItems,
  planRoundTenders,
  ringSaleThroughSquare,
  seedSandboxCatalog,
  squareSimEnvironment,
  type RoundTenderMode,
  type RungSale,
  type SeedMode,
} from "@/lib/market/square-sandbox";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

const MARKET_PATHS = ["/market", "/market/board"] as const;

function revalidateMarket() {
  revalidatePath("/settings/market", "layout");
  for (const path of MARKET_PATHS) revalidatePath(path);
}

/* Only for the four things that change which items exist or which variation a
   drink points at. The map is cached for an hour precisely so ordinary ticks
   do not re-read the catalog, so this must not go in revalidateMarket. */
function revalidateSquareItemMap() {
  updateTag(SQUARE_ITEM_MAP_TAG);
}

const configSchema = z.object({
  tickIntervalSec: z.coerce.number().min(15).max(600),
  noiseSigma: z.coerce.number().min(0.001).max(0.2),
  floorPct: z.coerce.number().min(0.1).max(1),
  ceilPct: z.coerce.number().min(1).max(5),
  moveNotifyPct: z.coerce.number().min(0.01).max(0.5),
  lowStockThreshold: z.coerce.number().min(1).max(100),
  leaderboardRows: z.coerce.number().int().min(0).max(15),
});

const tierSchema = z.object({
  rerankEveryTicks: z.coerce.number().int().min(1).max(60),
  glidePct: z.coerce.number().min(0.05).max(1),
  warmupUnits: z.coerce.number().int().min(0).max(1000),
  paceFloorUnits: z.coerce.number().min(1).max(500),
  tierPcts: z.object({
    down: z.array(z.coerce.number().min(0).max(0.9)).length(3),
    up: z.array(z.coerce.number().min(0).max(0.9)).length(3),
    bands: z.array(z.number()).length(3),
  }),
});

type TierConfig = z.infer<typeof tierSchema> & { pricingMode: PricingMode };

function readPushAlertsEnabled(formData: FormData): boolean {
  return formData.get("pushAlertsEnabled") === "on";
}

function pctField(formData: FormData, key: string, fallback: number): number {
  const raw = formData.get(key)?.toString().trim();
  if (raw === undefined || raw === "") return fallback;
  return Number(raw) / 100;
}

/* Tier dials are only on the form when the tier mode is selected; a demand
   event keeps the defaults so switching modes later starts from sane values. */
function readTierConfig(formData: FormData, current: MarketConfig = DEFAULT_MARKET_CONFIG): TierConfig | null {
  const pricingMode: PricingMode = formData.get("pricingMode") === "tiers" ? "tiers" : "demand";
  if (pricingMode === "demand") {
    return {
      pricingMode,
      rerankEveryTicks: current.rerankEveryTicks,
      glidePct: current.glidePct,
      warmupUnits: current.warmupUnits,
      paceFloorUnits: current.paceFloorUnits,
      tierPcts: current.tierPcts,
    };
  }
  const parsed = tierSchema.safeParse({
    rerankEveryTicks: formData.get("rerankEveryTicks"),
    glidePct: formData.get("glidePct"),
    warmupUnits: formData.get("warmupUnits"),
    paceFloorUnits: formData.get("paceFloorUnits"),
    tierPcts: {
      down: [0, 1, 2].map((i) => pctField(formData, `tierDown${i}`, current.tierPcts.down[i] ?? 0)),
      up: [0, 1, 2].map((i) => pctField(formData, `tierUp${i}`, current.tierPcts.up[i] ?? 0)),
      bands: current.tierPcts.bands,
    },
  });
  return parsed.success ? { pricingMode, ...parsed.data } : null;
}

function readConfig(formData: FormData, base: MarketConfig = DEFAULT_MARKET_CONFIG) {
  const parsed = configSchema.safeParse({
    tickIntervalSec: formData.get("tickIntervalSec"),
    noiseSigma: formData.get("noiseSigma"),
    floorPct: formData.get("floorPct"),
    ceilPct: formData.get("ceilPct"),
    moveNotifyPct: formData.get("moveNotifyPct"),
    lowStockThreshold: formData.get("lowStockThreshold"),
    leaderboardRows: formData.get("leaderboardRows") ?? 0,
  });
  if (!parsed.success) return null;
  const tier = readTierConfig(formData, base);
  if (!tier) return null;
  return { ...base, ...parsed.data, ...tier, pushAlertsEnabled: readPushAlertsEnabled(formData) };
}

type PriceRow = {
  id: number;
  serve: string;
  amount: number | string;
  display_order: number;
  square_variation_id: string | null;
};

type ServeItemJoin = { id: number; name: string; is_active: boolean } | null;

type ServeRow = {
  id: number;
  menu_item_id: number;
  serve: string;
  amount: number | string;
  square_variation_id: string | null;
  menu_items: ServeItemJoin | ServeItemJoin[];
};

export type TradeableServe = {
  id: number;
  menuItemId: number;
  name: string;
  serve: string;
  amount: number;
  squareVariationId: string | null;
};

/* The serves (menu_item_prices rows) staff can put on a market: priced and
   belonging to an active menu item. Everything that links an event to a
   drink goes through here so each link carries both the serve and its item. */
async function tradeableServes(
  supabase: ServerClient,
  menuItemPriceIds: number[]
): Promise<TradeableServe[] | { error: string }> {
  if (menuItemPriceIds.length === 0) return [];
  const { data, error } = await supabase
    .from("menu_item_prices")
    .select("id, menu_item_id, serve, amount, square_variation_id, menu_items(id, name, is_active)")
    .in("id", menuItemPriceIds);
  if (error) return { error: error.message };
  return ((data ?? []) as ServeRow[]).flatMap((row) => {
    const item = Array.isArray(row.menu_items) ? row.menu_items[0] : row.menu_items;
    if (!item || !item.is_active || !(Number(row.amount) > 0)) return [];
    return [
      {
        id: row.id,
        menuItemId: row.menu_item_id,
        name: item.name,
        serve: row.serve,
        amount: Number(row.amount),
        squareVariationId: row.square_variation_id,
      },
    ];
  });
}

async function openSession(
  supabase: ServerClient,
  options: {
    config: MarketConfig;
    menuItemPriceIds: number[];
    overridesByPrice: Map<number, DrinkOverrides>;
    stockMarketEventId: number;
    normals?: ResolvedNormals;
  }
) {
  const { data: existing } = await supabase
    .from("market_sessions")
    .select("id")
    .eq("status", "live")
    .maybeSingle();
  if (existing) return { error: "A market is already live - close it before opening another." };

  const serves = await tradeableServes(supabase, options.menuItemPriceIds);
  if ("error" in serves) return { error: serves.error };
  if (serves.length === 0) {
    return { error: "None of the serves on this event has a price to trade." };
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

  const instrumentRows = serves.map((serve) => {
    const overrides = options.overridesByPrice.get(serve.id) ?? EMPTY_OVERRIDES;
    const opening = overrides.openingPrice ?? serve.amount;
    return {
      session_id: session.id,
      menu_item_price_id: serve.id,
      menu_item_id: serve.menuItemId,
      display_name: serve.name,
      serve: serve.serve,
      base_price: serve.amount,
      opening_price: opening,
      current_price: opening,
      last_notified_price: opening,
      square_variation_id: serve.squareVariationId,
      min_price: overrides.minPrice,
      max_price: overrides.maxPrice,
      crash_price: overrides.crashPrice,
      low_stock_at: overrides.lowStockAt,
      alert_threshold: overrides.alertThreshold,
      normal_units_per_night: options.normals?.get(serve.id)?.value ?? null,
      normal_units_source: options.normals?.get(serve.id)?.source ?? null,
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

  /* Snapshot the real Square prices before the first tick can overwrite them,
     so ending the market puts the menu back exactly as it was. Non-fatal: an
     unreachable Square just means nothing to restore later. */
  try {
    await captureSquareOriginalPrices(supabase, session.id);
  } catch (err) {
    console.error("[market] could not snapshot Square prices:", err);
  }

  return { success: true, count: instrumentRows.length };
}

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

const eventSchema = configSchema.extend({
  name: z.string().trim().min(1, "Name is required.").max(80),
  open_time: z.string().regex(CLOCK, "Opening time is required."),
  close_time: z.string().regex(CLOCK, "Closing time is required."),
});

function readWeekdays(formData: FormData): number[] {
  return [...new Set(formData.getAll("weekdays").map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
}

function readOptionalWeekday(formData: FormData, key: string): number | null {
  const raw = formData.get(key)?.toString() ?? "";
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 6 ? n : null;
}

function readMenuItemPriceIds(formData: FormData): number[] {
  try {
    const raw = JSON.parse(formData.get("menu_item_price_ids")?.toString() || "[]");
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
    leaderboardRows: formData.get("leaderboardRows") ?? 0,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const configKeys = Object.keys(configSchema.shape);
    const message = configKeys.includes(String(issue?.path[0]))
      ? "Check the market settings - every number needs a sensible value."
      : (issue?.message ?? "Check the event details.");
    return { error: message };
  }

  const tier = readTierConfig(formData);
  if (!tier) return { error: "Check the tier settings - every number needs a sensible value." };

  const menuItemPriceIds = readMenuItemPriceIds(formData);
  if (menuItemPriceIds.length === 0) return { error: "Pick at least one drink for this event." };

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
    leaderboard_rows: values.leaderboardRows,
    push_alerts_enabled: readPushAlertsEnabled(formData),
    pricing_mode: tier.pricingMode,
    rerank_every_ticks: tier.rerankEveryTicks,
    glide_pct: tier.glidePct,
    warmup_units: tier.warmupUnits,
    tier_pcts: tier.tierPcts,
    pace_floor_units: tier.paceFloorUnits,
    weekdays: readWeekdays(formData),
    bank_holiday_profile: readOptionalWeekday(formData, "bank_holiday_profile"),
    exclude_market_nights: formData.get("exclude_market_nights") !== "off",
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

  const nightOnlyIds = await nightOnlyPriceIds(supabase, eventId);
  const serves = await tradeableServes(supabase, [...new Set([...menuItemPriceIds, ...nightOnlyIds])]);
  if ("error" in serves) return { error: serves.error };
  if (serves.length === 0) return { error: "Pick at least one drink for this event." };

  const { data: existingItems, error: existingError } = await supabase
    .from("stock_market_event_items")
    .select("menu_item_price_id")
    .eq("event_id", eventId);
  if (existingError) return { error: existingError.message };
  const keepSet = new Set(serves.map((serve) => serve.id));
  const dropped = (existingItems ?? [])
    .map((item) => item.menu_item_price_id as number)
    .filter((priceId) => !keepSet.has(priceId));
  if (dropped.length > 0) {
    const { error: clearError } = await supabase
      .from("stock_market_event_items")
      .delete()
      .eq("event_id", eventId)
      .in("menu_item_price_id", dropped);
    if (clearError) return { error: clearError.message };
  }
  const { error: itemsError } = await supabase
    .from("stock_market_event_items")
    .upsert(serves.map((serve) => eventItemLink(eventId, serve)), {
      onConflict: "event_id,menu_item_price_id",
      ignoreDuplicates: true,
    });
  if (itemsError) return { error: itemsError.message };

  revalidateMarket();
  return { success: true, id: eventId };
}

function eventItemLink(eventId: number, serve: { id: number; menuItemId: number }) {
  return { event_id: eventId, menu_item_id: serve.menuItemId, menu_item_price_id: serve.id };
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

function normalUnitsEventRow(row: StockMarketEventRow): NormalUnitsEventRow {
  return {
    id: row.id,
    weekdays: row.weekdays ?? [],
    bank_holiday_profile: row.bank_holiday_profile ?? null,
    exclude_market_nights: row.exclude_market_nights ?? true,
  };
}

export async function openStockMarketEventAction(id: number) {
  const supabase = await createClient();
  const { data: event, error } = await supabase
    .from("stock_market_events")
    .select(
      "*, stock_market_event_items(menu_item_price_id, opening_price, min_price, max_price, crash_price, low_stock_at, alert_threshold, normal_units_per_night)"
    )
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!event) return { error: "That event is no longer available." };

  const row = event as StockMarketEventRow & {
    stock_market_event_items:
      | ({ menu_item_price_id: number; normal_units_per_night?: number | string | null } & DrinkOverrideRow)[]
      | null;
  };
  const items = row.stock_market_event_items ?? [];
  const menuItemPriceIds = items.map((item) => item.menu_item_price_id);
  if (menuItemPriceIds.length === 0) return { error: "This event has no drinks - edit it and pick some." };

  const config: MarketConfig = {
    ...eventConfig(row),
    sessionTicksHint: sessionTicksFor(row.open_time, row.close_time, Number(row.tick_interval_sec)),
  };
  const normals = await resolveNormalsForOpen(
    supabase,
    normalUnitsEventRow(row),
    items.map((item) => ({ menuItemPriceId: item.menu_item_price_id, override: optionalNumber(item.normal_units_per_night) })),
    config
  );

  const result = await openSession(supabase, {
    config,
    menuItemPriceIds,
    overridesByPrice: new Map(items.map((item) => [item.menu_item_price_id, overridesFromRow(item)])),
    stockMarketEventId: row.id,
    normals,
  });
  if ("error" in result) return result;
  revalidateMarket();
  return result;
}

type EventItemJoin = {
  menu_item_price_id: number;
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

async function nightOnlyPriceIds(supabase: ServerClient, eventId: number): Promise<number[]> {
  const { data } = await supabase
    .from("stock_market_event_items")
    .select("menu_item_price_id, menu_items(menu_categories(market_only))")
    .eq("event_id", eventId);
  return ((data ?? []) as EventItemJoin[])
    .filter(isMarketOnlyJoin)
    .map((row) => row.menu_item_price_id);
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

export async function addEventDrinksAction(eventId: number, menuItemPriceIds: number[]) {
  const supabase = await createClient();
  const ids = [...new Set(menuItemPriceIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (ids.length === 0) return { error: "Pick at least one drink to add." };
  if (!(await eventExists(supabase, eventId))) return { error: "That event is no longer available." };

  const serves = await tradeableServes(supabase, ids);
  if ("error" in serves) return { error: serves.error };
  if (serves.length === 0) return { error: "None of those serves has a price to trade." };

  const { error } = await supabase
    .from("stock_market_event_items")
    .upsert(serves.map((serve) => eventItemLink(eventId, serve)), {
      onConflict: "event_id,menu_item_price_id",
      ignoreDuplicates: true,
    });
  if (error) return { error: error.message };
  revalidateMarket();
  return { success: true, count: serves.length };
}

export async function removeEventDrinkAction(eventId: number, menuItemPriceId: number) {
  const supabase = await createClient();
  const { data: link } = await supabase
    .from("stock_market_event_items")
    .select("menu_item_id")
    .eq("event_id", eventId)
    .eq("menu_item_price_id", menuItemPriceId)
    .maybeSingle();
  if (!link) return { error: "That serve is not on this event." };
  const menuItemId = link.menu_item_id as number;

  const { error } = await supabase
    .from("stock_market_event_items")
    .delete()
    .eq("event_id", eventId)
    .eq("menu_item_price_id", menuItemPriceId);
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

async function serveOwner(
  supabase: ServerClient,
  menuItemPriceId: number
): Promise<{ id: number; menuItemId: number } | null> {
  const { data } = await supabase
    .from("menu_item_prices")
    .select("id, menu_item_id")
    .eq("id", menuItemPriceId)
    .maybeSingle();
  return data ? { id: data.id as number, menuItemId: data.menu_item_id as number } : null;
}

async function writeDrinkOverrides(
  supabase: ServerClient,
  eventId: number,
  serve: { id: number; menuItemId: number },
  overrides: DrinkOverrides
): Promise<{ error: string } | null> {
  const { error } = await supabase
    .from("stock_market_event_items")
    .upsert(
      { ...eventItemLink(eventId, serve), ...overridesToRow(overrides) },
      { onConflict: "event_id,menu_item_price_id" }
    );
  return error ? { error: error.message } : null;
}

export async function saveEventDrinkPricingAction(formData: FormData) {
  const supabase = await createClient();
  const eventId = Number(formData.get("event_id"));
  const menuItemPriceId = Number(formData.get("menu_item_price_id"));
  if (!Number.isInteger(eventId) || eventId <= 0) return { error: "Missing event." };
  if (!Number.isInteger(menuItemPriceId) || menuItemPriceId <= 0) return { error: "Missing drink." };
  if (!(await eventExists(supabase, eventId))) return { error: "That event is no longer available." };

  const overrides = readDrinkOverrides(formData);
  if ("error" in overrides) return overrides;

  const serve = await serveOwner(supabase, menuItemPriceId);
  if (!serve) return { error: "That serve is no longer on the menu." };

  const writeError = await writeDrinkOverrides(supabase, eventId, serve, overrides);
  if (writeError) return writeError;
  revalidateMarket();
  return { success: true, id: menuItemPriceId };
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
          .select("id")
          .single()
      : supabase
          .from("menu_item_prices")
          .insert({
            menu_item_id: id,
            serve,
            amount,
            display_order: 0,
            created_by: currentEmployeeId,
            updated_by: currentEmployeeId,
          })
          .select("id")
          .single();
    const { data: savedPrice, error: priceError } = await priceWrite;
    if (priceError || !savedPrice) return { error: priceError?.message ?? "Could not save the price." };

    const overrideError = await writeDrinkOverrides(
      supabase,
      eventId,
      { id: savedPrice.id as number, menuItemId: id },
      overrides
    );
    if (overrideError) return overrideError;

    revalidateMarket();
    return { success: true, id: savedPrice.id as number };
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

  const { data: insertedPrice, error: priceError } = await supabase
    .from("menu_item_prices")
    .insert({
      menu_item_id: inserted.id,
      serve,
      amount,
      display_order: 0,
      created_by: currentEmployeeId,
      updated_by: currentEmployeeId,
    })
    .select("id")
    .single();
  if (priceError || !insertedPrice) {
    await supabase.from("menu_items").delete().eq("id", inserted.id);
    return { error: priceError?.message ?? "Could not save the price." };
  }

  const { error: linkError } = await supabase.from("stock_market_event_items").insert({
    ...eventItemLink(eventId, { id: insertedPrice.id as number, menuItemId: inserted.id }),
    ...overridesToRow(overrides),
  });
  if (linkError) return { error: linkError.message };

  revalidateMarket();
  return { success: true, id: insertedPrice.id as number };
}

export async function updateConfigAction(formData: FormData) {
  const supabase = await createClient();
  const { data: live } = await supabase
    .from("market_sessions")
    .select("config")
    .eq("status", "live")
    .maybeSingle();
  const config = readConfig(formData, resolveMarketConfig(live?.config));
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
  const { data: session } = await supabase
    .from("market_sessions")
    .select("id")
    .eq("status", "live")
    .maybeSingle();
  if (!session) return { error: "No live market to end." };

  /* Put the till back first. The market stays live if this fails, so the
     control panel keeps showing the restore button rather than silently
     leaving Saturday-night prices on the menu. */
  let restored = 0;
  try {
    const restore = await restoreSquarePrices(supabase, session.id);
    if (restore.errors.length > 0) {
      return { error: `Till prices were NOT restored: ${restore.errors[0].message}` };
    }
    restored = restore.written;
  } catch (err) {
    console.error("[market] restore failed:", err);
    return { error: "Could not reach Square to restore the till prices. Try again." };
  }

  const swept = await sweepSeededItems(supabase, session.id);

  const { error } = await supabase
    .from("market_sessions")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("id", session.id);
  if (error) return { error: error.message };
  revalidateMarket();
  return { success: true, restored, swept };
}

/* Temporary sandbox items only ever exist for the market that seeded them, so
   they go when it closes - otherwise every temp seed leaves another copy of
   every drink in the catalog. Mapped items have no sandbox_item_id and are
   never touched, and a failure here never blocks the close. */
async function sweepSeededItems(supabase: ServerClient, sessionId: number): Promise<number> {
  if (!squareSimEnvironment().isSandbox) return 0;
  const { data } = await supabase
    .from("market_instruments")
    .select("sandbox_item_id")
    .eq("session_id", sessionId)
    .not("sandbox_item_id", "is", null);
  const itemIds = (data ?? [])
    .map((row) => row.sandbox_item_id as string | null)
    .filter((id): id is string => Boolean(id));
  if (itemIds.length === 0) return 0;
  try {
    const deleted = await deleteSeededItems(itemIds);
    await supabase
      .from("market_instruments")
      .update({ sandbox_item_id: null })
      .eq("session_id", sessionId);
    revalidateSquareItemMap();
    return deleted;
  } catch (err) {
    console.error("[market] sandbox item sweep failed:", err);
    return 0;
  }
}

/* "Restore till prices" button. Works on the live market (engine misbehaved)
   AND on an ended one (Square was unreachable when the market closed, or the
   market was ended before this sync existed). With no id it targets whichever
   session most recently left market prices on the till. */
export async function restoreTillPricesAction(sessionId?: number) {
  const supabase = await createClient();

  let targetId = sessionId ?? null;
  if (targetId == null) {
    const { data: live } = await supabase
      .from("market_sessions")
      .select("id")
      .eq("status", "live")
      .maybeSingle();
    targetId = live?.id ?? null;
  }
  if (targetId == null) {
    const { data: stale } = await supabase
      .from("market_instruments")
      .select("session_id, market_sessions!inner(started_at)")
      .not("square_synced_price", "is", null)
      .not("square_original_price", "is", null)
      .order("started_at", { referencedTable: "market_sessions", ascending: false })
      .limit(1)
      .maybeSingle();
    targetId = stale?.session_id ?? null;
  }
  if (targetId == null) return { error: "Nothing to restore - the till already has its normal prices." };

  try {
    const restore = await restoreSquarePrices(supabase, targetId);
    if (restore.errors.length > 0) return { error: restore.errors[0].message };
    revalidateMarket();
    return { success: true, restored: restore.written };
  } catch (err) {
    console.error("[market] restore failed:", err);
    return { error: "Could not reach Square. Check the Square configuration." };
  }
}

export async function setSquareSyncEnabledAction(enabled: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("market_sessions")
    .update({ square_sync_enabled: enabled })
    .eq("status", "live");
  if (error) return { error: error.message };
  revalidateMarket();
  return { success: true };
}

export async function rerankNowAction() {
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("market_sessions")
    .select("id, tick_no, config, warmed_up_tick")
    .eq("status", "live")
    .maybeSingle();
  if (!session) return { error: "No live market to re-rank." };
  const config = resolveMarketConfig(session.config);
  if (config.pricingMode !== "tiers") return { error: "This market is running the demand engine - there are no tiers to re-rank." };
  /* Marking warm-up as "this coming tick" makes shouldRerank fire on it, and
     lifts the warm-up gate early if staff want tiers on before the threshold. */
  const { error } = await supabase
    .from("market_sessions")
    .update({ warmed_up_tick: session.tick_no + 1 })
    .eq("id", session.id);
  if (error) return { error: error.message };
  const forced = await forceTickNow(session.id);
  if ("error" in forced) return forced;
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

/* The table shows "Linked" per drink; this is what that link opens. The stored
   id is the ITEM_VARIATION, and the Square dashboard addresses items by their
   parent ITEM, so the variation is read back to find it. */
export async function squareItemLinkAction(instrumentId: number) {
  const supabase = await createClient();
  const { data: instrument } = await supabase
    .from("market_instruments")
    .select("display_name, square_variation_id")
    .eq("id", instrumentId)
    .maybeSingle();
  if (!instrument) return { error: "That drink is not trading on the live market." };
  if (!instrument.square_variation_id) {
    return { error: `${instrument.display_name} is not linked to a Square item.` };
  }

  try {
    const res = await squareClient.catalog.batchGet({
      objectIds: [instrument.square_variation_id],
      includeRelatedObjects: false,
      includeDeletedObjects: false,
    });
    const variation = res.objects?.[0];
    const itemId =
      variation?.type === "ITEM_VARIATION" ? variation.itemVariationData?.itemId : null;
    if (!itemId) {
      return { error: `Square no longer has a variation with that id for ${instrument.display_name}.` };
    }
    return { url: squareItemUrl(squareSimEnvironment().environment, itemId) };
  } catch (err) {
    console.error("[market] square item lookup failed:", err);
    return { error: "Could not reach the Square catalog." };
  }
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

  revalidateSquareItemMap();
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
  revalidateSquareItemMap();
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
  if ((await liveMarketSessionId(supabase)) != null) return { error: LIVE_MARKET_MENU_MESSAGE };

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

    revalidateSquareItemMap();
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

export type DrinkPriceDraft = {
  menuItemPriceId: number;
  overrides: Record<keyof DrinkOverrides, string | number | null>;
};

export async function recalculateNormalUnitsAction(eventId: number) {
  const supabase = await createClient();
  if (!Number.isInteger(eventId) || eventId <= 0) return { error: "Missing event." };
  const { data: event, error } = await supabase
    .from("stock_market_events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!event) return { error: "That event is no longer available." };
  const row = event as StockMarketEventRow;
  if ((row.weekdays ?? []).length === 0) {
    return { error: "Pick which day(s) of the week this event runs on first." };
  }
  try {
    const result = await recalculateNormalUnits(supabase, normalUnitsEventRow(row));
    revalidateMarket();
    const nights = Object.values(result.sampledNights).reduce((sum, list) => sum + list.length, 0);
    return {
      success: true,
      serves: new Set(result.rows.map((r) => r.menuItemPriceId)).size,
      nights,
      unmappedServes: result.unmappedServes,
      lastSyncedAt: result.lastSyncedAt,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not work out normal sales from the synced Square orders.",
    };
  }
}

/* The same pull the nightly cron does, on demand. Runs as the service role
   because square_sales is written by the cron, never by a signed-in user. */
export async function syncSquareSalesAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to sync sales." };
  const result = await syncSquareSales(createAdminClient());
  if (result.status === "error") return { error: result.error ?? "Could not sync sales from Square." };
  revalidateMarket();
  return { success: true, ordersSynced: result.ordersSynced, linesSynced: result.linesSynced };
}

export async function saveEventNormalUnitsAction(eventId: number, menuItemPriceId: number, value: number | null) {
  const supabase = await createClient();
  if (!Number.isInteger(eventId) || eventId <= 0) return { error: "Missing event." };
  if (value !== null && (!Number.isFinite(value) || value <= 0)) {
    return { error: "Normal units must be a positive number, or blank to use Square history." };
  }
  const { error } = await supabase
    .from("stock_market_event_items")
    .update({ normal_units_per_night: value })
    .eq("event_id", eventId)
    .eq("menu_item_price_id", menuItemPriceId);
  if (error) return { error: error.message };
  revalidateMarket();
  return { success: true };
}

export async function saveEventDrinkPricesAction(eventId: number, rows: DrinkPriceDraft[]) {
  const supabase = await createClient();
  if (!Number.isInteger(eventId) || eventId <= 0) return { error: "Missing event." };
  if (rows.length === 0) return { error: "Nothing to save." };
  if (!(await eventExists(supabase, eventId))) return { error: "That event is no longer available." };

  const { data: serveRows, error: serveError } = await supabase
    .from("menu_item_prices")
    .select("id, menu_item_id")
    .in(
      "id",
      rows.map((row) => row.menuItemPriceId)
    );
  if (serveError) return { error: serveError.message };
  const menuItemByPrice = new Map(
    (serveRows ?? []).map((row) => [row.id as number, row.menu_item_id as number])
  );

  const payload: (DrinkOverrideRow & {
    event_id: number;
    menu_item_id: number;
    menu_item_price_id: number;
  })[] = [];
  for (const row of rows) {
    const menuItemId = menuItemByPrice.get(row.menuItemPriceId);
    if (menuItemId == null) return { error: "One of those serves is no longer on the menu." };
    const parsed = drinkOverridesSchema.safeParse(row.overrides);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Check the prices." };
    }
    payload.push({
      ...eventItemLink(eventId, { id: row.menuItemPriceId, menuItemId }),
      ...overridesToRow(parsed.data),
    });
  }

  const { error } = await supabase
    .from("stock_market_event_items")
    .upsert(payload, { onConflict: "event_id,menu_item_price_id" });
  if (error) return { error: error.message };
  revalidateMarket();
  return { success: true, count: payload.length };
}

export async function setInstrumentPriceAction(instrumentId: number, price: number) {
  const supabase = await createClient();
  if (!Number.isFinite(price) || price <= 0) return { error: "Enter a price above zero." };

  const { data: session } = await supabase
    .from("market_sessions")
    .select("id, config")
    .eq("status", "live")
    .maybeSingle();
  if (!session) return { error: "No live market." };

  const { data: instrument } = await supabase
    .from("market_instruments")
    .select("id, base_price, min_price, max_price")
    .eq("id", instrumentId)
    .eq("session_id", session.id)
    .maybeSingle();
  if (!instrument) return { error: "That drink is not trading on the live market." };

  const config = resolveMarketConfig(session.config);
  const basePrice = Number(instrument.base_price);
  const floor = optionalNumber(instrument.min_price) ?? basePrice * config.floorPct;
  const ceil = optionalNumber(instrument.max_price) ?? basePrice * config.ceilPct;
  const clamped = Math.min(Math.max(price, floor), ceil);
  const rounded = Math.round(clamped / config.roundStep) * config.roundStep;
  const currentPrice = Number(rounded.toFixed(2));

  const { error } = await supabase
    .from("market_instruments")
    .update({ current_price: currentPrice, updated_at: new Date().toISOString() })
    .eq("id", instrument.id);
  if (error) return { error: error.message };

  revalidateMarket();
  return { success: true, price: currentPrice };
}

/* ─── Simulated sales ────────────────────────────────────────────────────────
   The engine only learns about demand once per tick, from Square's completed
   orders. These actions queue fake "units sold" rows that the next tick adds
   on top of the till figures (see market_sim_sales in tick.ts), so a market
   can be exercised on a quiet afternoon - or before the Square links are
   done - without a sandbox catalog or a real customer. Prices, alerts and the
   Square price sync all behave exactly as they would for a real sale. */

type SimSession = { id: number; tick_no: number; config: unknown };

async function liveSimSession(supabase: ServerClient): Promise<SimSession | { error: string }> {
  const { data: session, error } = await supabase
    .from("market_sessions")
    .select("id, tick_no, config")
    .eq("status", "live")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!session) return { error: "No live market - open one before simulating sales." };
  return session as SimSession;
}

export type SimMode = "queue" | "square";

type SimInstrumentRow = {
  id: number;
  display_name: string;
  stock_state: string;
  stock_override: string | null;
  square_variation_id: string | null;
};

async function liveSimInstruments(
  supabase: ServerClient,
  sessionId: number
): Promise<SimInstrumentRow[] | { error: string }> {
  const { data, error } = await supabase
    .from("market_instruments")
    .select("id, display_name, stock_state, stock_override, square_variation_id")
    .eq("session_id", sessionId);
  if (error) return { error: error.message };
  return (data ?? []) as SimInstrumentRow[];
}

/* Sandbox sales are recorded already-consumed: the units reach the engine
   through Square's orders.search on the next tick, not through this table. */
async function recordSquareSales(
  supabase: ServerClient,
  session: SimSession,
  sales: { instrumentId: number; units: number; rung: RungSale }[],
  createdBy: number | null
) {
  if (sales.length === 0) return null;
  const { error } = await supabase.from("market_sim_sales").insert(
    sales.map((sale) => ({
      session_id: session.id,
      instrument_id: sale.instrumentId,
      units: sale.units,
      source: "square_sandbox",
      created_by: createdBy,
      consumed_tick_no: session.tick_no,
      square_order_id: sale.rung.orderId,
      square_payment_id: sale.rung.paymentId,
      amount: sale.rung.amount,
      tender: sale.rung.tender,
    }))
  );
  return error ? { error: error.message } : null;
}

/* A sale only needs the variation id the instrument already carries from the
   menu mapping, so seeding is a convenience (known stock levels, throwaway
   items for unmapped drinks) rather than a prerequisite. */
const NOT_LINKED =
  "No drinks on this market are linked to Square - map them on the menu, or seed temporary items.";

export async function simulateSaleAction(
  instrumentId: number,
  units: number,
  mode: SimMode = "queue"
) {
  const supabase = await createClient();
  if (!isValidSaleUnits(units)) {
    return { error: `Sell between 1 and ${SIM_MAX_UNITS_PER_SALE} at a time.` };
  }
  const session = await liveSimSession(supabase);
  if ("error" in session) return session;

  const { data: instrument } = await supabase
    .from("market_instruments")
    .select("id, display_name, square_variation_id")
    .eq("id", instrumentId)
    .eq("session_id", session.id)
    .maybeSingle();
  if (!instrument) return { error: "That drink is not trading on the live market." };

  const currentEmployeeId = await getCurrentEmployeeId(supabase);

  if (mode === "square") {
    const guard = assertSandbox();
    if ("error" in guard) return guard;
    if (!instrument.square_variation_id) {
      return {
        error: `${instrument.display_name} is not linked to Square - map it on the menu, or seed a temporary item for it.`,
      };
    }
    let rung: RungSale;
    try {
      rung = await ringSaleThroughSquare(
        guard.locationId,
        [{ variationId: instrument.square_variation_id, quantity: units }],
        "card"
      );
    } catch (err) {
      console.error("[market] sandbox sale failed:", err);
      return { error: err instanceof Error ? err.message : "Square sandbox rejected the sale." };
    }
    const recordError = await recordSquareSales(
      supabase,
      session,
      [{ instrumentId: instrument.id, units, rung }],
      currentEmployeeId
    );
    if (recordError) return recordError;
    revalidateMarket();
    return { success: true, name: instrument.display_name as string, units, amount: rung.amount, orderId: rung.orderId };
  }

  const { error } = await supabase.from("market_sim_sales").insert({
    session_id: session.id,
    instrument_id: instrument.id,
    units,
    source: "manual",
    created_by: currentEmployeeId,
  });
  if (error) return { error: error.message };

  revalidateMarket();
  return { success: true, name: instrument.display_name as string, units };
}

export async function simulateBusyRoundAction(
  sales: number,
  favouriteId?: number | null,
  mode: SimMode = "queue",
  tenderMode: RoundTenderMode = "mix"
) {
  const supabase = await createClient();
  if (!Number.isFinite(sales) || sales < 1) return { error: "Pick how many sales to ring up." };
  const session = await liveSimSession(supabase);
  if ("error" in session) return session;

  const rows = await liveSimInstruments(supabase, session.id);
  if ("error" in rows) return rows;
  const currentEmployeeId = await getCurrentEmployeeId(supabase);

  if (mode === "square") {
    const guard = assertSandbox();
    if ("error" in guard) return guard;
    const linked = rows.filter((row) => row.square_variation_id);
    if (linked.length === 0) return { error: NOT_LINKED };

    const plan = planBusyRound(
      linked.map((row) => ({
        id: row.id,
        soldOut: row.stock_override === "out" || row.stock_state === "out",
      })),
      { sales: Math.min(sales, SIM_MAX_SQUARE_ROUND_SALES), favouriteId: favouriteId ?? null }
    );
    if (plan.length === 0) return { error: "Every drink on the board is sold out - nothing to sell." };

    const variationById = new Map(linked.map((row) => [row.id, row.square_variation_id as string]));
    const tenders = planRoundTenders(plan.length, tenderMode);
    const rung: { instrumentId: number; units: number; rung: RungSale }[] = [];
    let failure: string | null = null;
    for (const [index, sale] of plan.entries()) {
      try {
        const result = await ringSaleThroughSquare(
          guard.locationId,
          [{ variationId: variationById.get(sale.instrumentId) as string, quantity: sale.units }],
          tenders[index]
        );
        rung.push({ instrumentId: sale.instrumentId, units: sale.units, rung: result });
      } catch (err) {
        console.error("[market] sandbox busy round stopped:", err);
        failure = err instanceof Error ? err.message : "Square sandbox rejected a sale.";
        break;
      }
    }
    const recordError = await recordSquareSales(supabase, session, rung, currentEmployeeId);
    if (recordError) return recordError;
    revalidateMarket();
    if (rung.length === 0) return { error: failure ?? "Square sandbox rejected the round." };
    const units = rung.reduce((sum, sale) => sum + sale.units, 0);
    const takings = rung.reduce((sum, sale) => sum + sale.rung.amount, 0);
    const cash = rung.filter((sale) => sale.rung.tender === "cash").length;
    return {
      success: true,
      sales: rung.length,
      units,
      takings,
      cash,
      card: rung.length - cash,
      partialError: failure,
    };
  }

  const plan = planBusyRound(
    rows.map((row) => ({
      id: row.id,
      soldOut: row.stock_override === "out" || row.stock_state === "out",
    })),
    { sales: Math.min(sales, SIM_MAX_ROUND_SALES), favouriteId: favouriteId ?? null }
  );
  if (plan.length === 0) return { error: "Every drink on the board is sold out - nothing to sell." };

  const { error } = await supabase.from("market_sim_sales").insert(
    plan.map((sale) => ({
      session_id: session.id,
      instrument_id: sale.instrumentId,
      units: sale.units,
      source: "busy_round",
      created_by: currentEmployeeId,
    }))
  );
  if (error) return { error: error.message };

  revalidateMarket();
  const units = plan.reduce((sum, sale) => sum + sale.units, 0);
  return { success: true, sales: plan.length, units };
}

export async function seedSandboxCatalogAction(stockQty: number, mode: SeedMode = "temp") {
  const supabase = await createClient();
  const session = await liveSimSession(supabase);
  if ("error" in session) return session;
  const qty = Number.isFinite(stockQty) ? Math.max(0, Math.min(999, Math.floor(stockQty))) : 40;

  try {
    const result = await seedSandboxCatalog(supabase, session.id, qty, mode);
    if ("error" in result) return result;
    revalidateSquareItemMap();
    revalidateMarket();
    return { success: true, ...result, stockQty: qty };
  } catch (err) {
    console.error("[market] sandbox seed failed:", err);
    return { error: err instanceof Error ? err.message : "Could not write to the Square sandbox catalog." };
  }
}

/* Drops sales the tick has not picked up yet; consumed rows stay as history. */
export async function clearSimulatedSalesAction() {
  const supabase = await createClient();
  const session = await liveSimSession(supabase);
  if ("error" in session) return session;

  const { error, count } = await supabase
    .from("market_sim_sales")
    .delete({ count: "exact" })
    .eq("session_id", session.id)
    .is("consumed_tick_no", null);
  if (error) return { error: error.message };
  revalidateMarket();
  return { success: true, cleared: count ?? 0 };
}

/* Runs the engine now instead of waiting out tickIntervalSec, so a simulated
   sale shows on the board straight away. Uses the admin client like the cron
   route does; the compare-and-swap in maybeRunMarketTick still protects
   against a cron tick landing at the same moment. */
async function forceTickNow(liveId: number): Promise<{ tickNo: number | null } | { error: string }> {
  const admin = createAdminClient();
  const { error: resetError } = await admin
    .from("market_sessions")
    .update({ last_tick_at: null })
    .eq("id", liveId)
    .eq("status", "live");
  if (resetError) return { error: resetError.message };

  const { data: session, error } = await admin
    .from("market_sessions")
    .select("*")
    .eq("id", liveId)
    .eq("status", "live")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!session) return { error: "The market closed before the tick could run." };

  await maybeRunMarketTick(admin, session as MarketSessionRow);

  const { data: after } = await admin
    .from("market_sessions")
    .select("tick_no")
    .eq("id", liveId)
    .maybeSingle();
  return { tickNo: (after?.tick_no as number | undefined) ?? null };
}

export async function runTickNowAction() {
  const supabase = await createClient();
  const live = await liveSimSession(supabase);
  if ("error" in live) return live;

  const ticked = await forceTickNow(live.id);
  if ("error" in ticked) return ticked;

  revalidateMarket();
  return { success: true, tickNo: ticked.tickNo ?? live.tick_no + 1 };
}

const STOCK_ADD_MAX = 500;

/* A real Square inventory adjustment for one linked serve, then a tick so
   the board's stock state and count catch up at once (and the engine's
   restock alert fires if the drink was sold out). */
export async function addStockAction(instrumentId: number, quantity: number) {
  const supabase = await createClient();
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > STOCK_ADD_MAX) {
    return { error: `Add between 1 and ${STOCK_ADD_MAX} at a time.` };
  }
  const session = await liveSimSession(supabase);
  if ("error" in session) return session;

  const env = squareSimEnvironment();
  if (!process.env.SQUARE_ACCESS_TOKEN) return { error: "SQUARE_ACCESS_TOKEN is not set." };
  if (!env.locationId) return { error: "SQUARE_LOCATION_ID is not set." };

  const { data: instrument } = await supabase
    .from("market_instruments")
    .select("id, display_name, square_variation_id")
    .eq("id", instrumentId)
    .eq("session_id", session.id)
    .maybeSingle();
  if (!instrument) return { error: "That drink is not trading on the live market." };
  if (!instrument.square_variation_id) {
    return { error: `${instrument.display_name} is not linked to Square, so it has no stock to add to.` };
  }

  try {
    await addInventory(env.locationId, instrument.square_variation_id, quantity);
  } catch (err) {
    console.error("[market] add stock failed:", err);
    return { error: err instanceof Error ? err.message : "Square rejected the stock change." };
  }

  const ticked = await forceTickNow(session.id);
  if ("error" in ticked) return ticked;

  revalidateMarket();
  return { success: true, name: instrument.display_name as string, quantity };
}

export type TickBreakdownRow = {
  tickNo: number;
  units: number | null;
  demandUnits: number | null;
  pace: number | null;
  minsSinceSale: number | null;
  rankValue: number | null;
  rankPos: number | null;
  tierPct: number | null;
  targetPrice: number | null;
  price: number;
  tillPrice: number | null;
  reranked: boolean;
};

const optional = (value: number | string | null) => (value == null ? null : Number(value));

/* Every tick this session for one drink, with the engine's working, for the
   trading floor's breakdown sheet. */
export async function instrumentTickBreakdownAction(
  instrumentId: number
): Promise<{ rows: TickBreakdownRow[] } | { error: string }> {
  const supabase = await createClient();
  const { data: instrument } = await supabase
    .from("market_instruments")
    .select("id, session_id")
    .eq("id", instrumentId)
    .maybeSingle();
  if (!instrument) return { error: "That drink is not on a market." };

  const tickQuery = (columns: string) =>
    supabase
      .from("market_ticks")
      .select(columns)
      .eq("instrument_id", instrumentId)
      .order("tick_no", { ascending: true })
      .limit(1000);
  const [{ data: session }, full] = await Promise.all([
    supabase
      .from("market_sessions")
      .select("config, warmed_up_tick")
      .eq("id", instrument.session_id)
      .maybeSingle(),
    tickQuery(
      "tick_no, units, demand_units, pace, mins_since_sale, rank_value, rank_pos, tier_pct, target_price, price, till_price"
    ),
  ]);
  /* Before the breakdown migration has run only price and demand exist. */
  const result = full.error ? await tickQuery("tick_no, demand_units, price") : full;
  if (result.error) return { error: result.error.message };
  const ticks = (result.data ?? []) as unknown as Record<string, number | string | null>[];

  const config = resolveMarketConfig(session?.config ?? null);
  const warmedUpTick = (session?.warmed_up_tick as number | null | undefined) ?? null;
  const rows: TickBreakdownRow[] = (ticks ?? []).map((row) => ({
    tickNo: row.tick_no as number,
    units: optional(row.units),
    demandUnits: optional(row.demand_units),
    pace: optional(row.pace),
    minsSinceSale: optional(row.mins_since_sale),
    rankValue: optional(row.rank_value),
    rankPos: optional(row.rank_pos),
    tierPct: optional(row.tier_pct),
    targetPrice: optional(row.target_price),
    price: Number(row.price),
    tillPrice: optional(row.till_price ?? null),
    reranked: shouldRerank(row.tick_no as number, warmedUpTick, config.rerankEveryTicks),
  }));
  return { rows };
}
