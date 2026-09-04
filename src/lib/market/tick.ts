import type { SupabaseClient } from "@supabase/supabase-js";
import { squareClient } from "@/lib/square";
import { runTick } from "./engine";
import { tickRng } from "./rng";
import {
  resolveMarketConfig,
  type InstrumentState,
  type MarketConfig,
  type MarketEventKind,
  type StockState,
} from "./types";

export type MarketSessionRow = {
  id: number;
  status: string;
  config: unknown;
  tick_no: number;
  last_tick_at: string | null;
  orders_watermark: string | null;
  crash_until_tick: number | null;
  started_at: string;
};

export type MarketInstrumentRow = {
  id: number;
  session_id: number;
  menu_item_price_id: number;
  menu_item_id: number;
  display_name: string;
  serve: string;
  base_price: number | string;
  opening_price: number | string;
  current_price: number | string;
  last_notified_price: number | string;
  demand_units: number | string;
  stock_state: StockState;
  stock_override: StockState | null;
  square_variation_id: string | null;
};

export type MarketInstrumentPayload = {
  id: number;
  name: string;
  serve: string;
  price: number;
  basePrice: number;
  changePct: number;
  direction: "up" | "down" | "flat";
  stock: StockState;
  spark: number[];
  category: string | null;
  categoryOrder: number;
  demandUnits: number;
  floor: number;
  ceil: number;
};

export type MarketEventPayload = {
  id: number;
  kind: MarketEventKind;
  name: string | null;
  serve: string | null;
  from: number | null;
  to: number | null;
  pct: number | null;
  at: string;
};

export type MarketStatePayload = {
  status: "live" | "closed";
  sessionId?: number;
  tickNo?: number;
  tickIntervalSec?: number;
  crashActive?: boolean;
  crashRemainingSec?: number;
  instruments?: MarketInstrumentPayload[];
  events?: MarketEventPayload[];
};

type MenuCategoryJoin = { name: string; display_order: number } | null;
type MenuItemJoin = { menu_categories: MenuCategoryJoin | MenuCategoryJoin[] } | null;
type MarketInstrumentWithCategoryRow = MarketInstrumentRow & {
  menu_items: MenuItemJoin | MenuItemJoin[];
};

function instrumentCategory(row: MarketInstrumentWithCategoryRow): {
  name: string | null;
  order: number;
} {
  const item = Array.isArray(row.menu_items) ? row.menu_items[0] : row.menu_items;
  const raw = item?.menu_categories;
  const category = Array.isArray(raw) ? raw[0] : raw;
  if (!category) return { name: null, order: Number.MAX_SAFE_INTEGER };
  return { name: category.name, order: Number(category.display_order) };
}

function crashRemainingSeconds(session: MarketSessionRow, config: MarketConfig, now: Date): number {
  const ticksLeft = (session.crash_until_tick ?? session.tick_no) - session.tick_no;
  const lastTick = session.last_tick_at ? new Date(session.last_tick_at).getTime() : now.getTime();
  const sinceLastTick = Math.max(0, (now.getTime() - lastTick) / 1000);
  return Math.round(
    ticksLeft * config.tickIntervalSec + Math.max(0, config.tickIntervalSec - sinceLastTick)
  );
}

const SPARK_TICKS = 30;
const WATERMARK_OVERLAP_MS = 60 * 1000;

function toInstrumentState(row: MarketInstrumentRow): InstrumentState {
  return {
    id: row.id,
    basePrice: Number(row.base_price),
    currentPrice: Number(row.current_price),
    lastNotifiedPrice: Number(row.last_notified_price),
    demandUnits: Number(row.demand_units),
    stockState: row.stock_state,
    stockOverride: row.stock_override,
    squareVariationId: row.square_variation_id,
  };
}

type OrderLineItem = { catalogObjectId?: string | null; quantity?: string | null };
type CompletedOrder = { closedAt?: string; lineItems?: OrderLineItem[] | null };

async function fetchDemandByVariation(
  locationId: string,
  watermark: Date,
  now: Date
): Promise<{ unitsByVariation: Map<string, number>; newWatermark: Date }> {
  const unitsByVariation = new Map<string, number>();
  let maxClosed = watermark;

  const beginTime = new Date(watermark.getTime() - WATERMARK_OVERLAP_MS).toISOString();
  let cursor: string | undefined;
  do {
    const res = await squareClient.orders.search({
      locationIds: [locationId],
      cursor,
      query: {
        filter: {
          stateFilter: { states: ["COMPLETED"] },
          dateTimeFilter: { closedAt: { startAt: beginTime, endAt: now.toISOString() } },
        },
        sort: { sortField: "CLOSED_AT", sortOrder: "ASC" },
      },
      limit: 500,
    });
    for (const order of (res.orders ?? []) as CompletedOrder[]) {
      const closed = order.closedAt ? new Date(order.closedAt) : null;
      if (!closed || closed.getTime() <= watermark.getTime()) continue;
      if (closed.getTime() > maxClosed.getTime()) maxClosed = closed;
      for (const li of order.lineItems ?? []) {
        if (!li.catalogObjectId) continue;
        const qty = Number(li.quantity ?? 1);
        if (!Number.isFinite(qty) || qty <= 0) continue;
        unitsByVariation.set(
          li.catalogObjectId,
          (unitsByVariation.get(li.catalogObjectId) ?? 0) + qty
        );
      }
    }
    cursor = res.cursor;
  } while (cursor);

  return { unitsByVariation, newWatermark: maxClosed };
}

async function fetchStockByVariation(
  locationId: string,
  variationIds: string[]
): Promise<Map<string, number>> {
  const stock = new Map<string, number>();
  if (variationIds.length === 0) return stock;
  try {
    const page = await squareClient.inventory.batchGetCounts({
      catalogObjectIds: variationIds,
      locationIds: [locationId],
    });
    for await (const count of page) {
      if (!count.catalogObjectId || count.state !== "IN_STOCK") continue;
      const qty = Number(count.quantity ?? 0);
      if (!Number.isFinite(qty)) continue;
      stock.set(count.catalogObjectId, (stock.get(count.catalogObjectId) ?? 0) + qty);
    }
  } catch (err) {
    console.error("[market] inventory fetch failed, keeping previous stock states:", err);
  }
  return stock;
}

/* The winner of the compare-and-swap on last_tick_at runs one engine tick;
   everyone else reads the state as-is. Square being down degrades to a pure
   random-walk tick rather than freezing the board. */
export async function maybeRunMarketTick(
  supabase: SupabaseClient,
  session: MarketSessionRow,
  now: Date = new Date()
): Promise<void> {
  const config = resolveMarketConfig(session.config);
  const lastTick = session.last_tick_at ? new Date(session.last_tick_at) : null;
  if (lastTick && now.getTime() - lastTick.getTime() < config.tickIntervalSec * 1000) return;

  /* tick_no equality is the compare-and-swap: a competing request that won
     already incremented it, so everyone else matches zero rows and reads. */
  const { data: won, error: casError } = await supabase
    .from("market_sessions")
    .update({ last_tick_at: now.toISOString(), tick_no: session.tick_no + 1 })
    .eq("id", session.id)
    .eq("status", "live")
    .eq("tick_no", session.tick_no)
    .select("id, tick_no");
  if (casError) {
    console.error("[market] tick claim failed:", casError);
    return;
  }
  if (!won || won.length === 0) return;

  const tickNo = won[0].tick_no as number;

  try {
    const { data: instrumentRows, error } = await supabase
      .from("market_instruments")
      .select("*")
      .eq("session_id", session.id);
    if (error) throw error;
    const instruments = (instrumentRows ?? []) as MarketInstrumentRow[];
    if (instruments.length === 0) return;

    const locationId = process.env.SQUARE_LOCATION_ID;
    const mappedVariationIds = instruments
      .map((i) => i.square_variation_id)
      .filter((id): id is string => Boolean(id));

    let unitsByVariation = new Map<string, number>();
    let stockQtyByVariation = new Map<string, number>();
    let newWatermark: Date | null = null;

    if (locationId && mappedVariationIds.length > 0) {
      try {
        const watermark = new Date(session.orders_watermark ?? session.started_at);
        const demand = await fetchDemandByVariation(locationId, watermark, now);
        unitsByVariation = demand.unitsByVariation;
        newWatermark = demand.newWatermark;
      } catch (err) {
        console.error("[market] orders fetch failed, ticking without demand:", err);
      }
      stockQtyByVariation = await fetchStockByVariation(locationId, mappedVariationIds);
    }

    const newUnitsByInstrument = new Map<number, number>();
    for (const instrument of instruments) {
      if (!instrument.square_variation_id) continue;
      const units = unitsByVariation.get(instrument.square_variation_id);
      if (units) newUnitsByInstrument.set(instrument.id, units);
    }

    const crashActive =
      session.crash_until_tick != null && tickNo <= session.crash_until_tick;

    const results = runTick(instruments.map(toInstrumentState), {
      config,
      crashActive,
      newUnitsByInstrument,
      stockQtyByVariation,
      rng: tickRng(session.id, tickNo),
    });

    const byId = new Map(instruments.map((i) => [i.id, i] as const));
    for (const result of results) {
      const { error: updateError } = await supabase
        .from("market_instruments")
        .update({
          current_price: result.price,
          demand_units: result.demandUnits,
          stock_state: result.stockState,
          last_notified_price: result.lastNotifiedPrice,
          updated_at: now.toISOString(),
        })
        .eq("id", result.id);
      if (updateError) throw updateError;
    }

    const { error: tickError } = await supabase.from("market_ticks").upsert(
      results.map((result) => ({
        session_id: session.id,
        instrument_id: result.id,
        tick_no: tickNo,
        price: result.price,
        demand_units: result.demandUnits,
      })),
      { onConflict: "instrument_id,tick_no", ignoreDuplicates: true }
    );
    if (tickError) throw tickError;

    const events = results.flatMap((result) =>
      result.events.map((event) => {
        const row = byId.get(event.instrumentId);
        return {
          session_id: session.id,
          instrument_id: event.instrumentId,
          kind: event.kind,
          payload: {
            name: row?.display_name ?? null,
            serve: row?.serve ?? null,
            ...event.payload,
          },
        };
      })
    );
    if (events.length > 0) {
      const { error: eventError } = await supabase.from("market_events").insert(events);
      if (eventError) throw eventError;
    }

    if (newWatermark) {
      await supabase
        .from("market_sessions")
        .update({ orders_watermark: newWatermark.toISOString() })
        .eq("id", session.id);
    }
  } catch (err) {
    console.error("[market] tick failed:", err);
  }
}

export async function readMarketState(
  supabase: SupabaseClient,
  sinceEventId: number | null,
  now: Date = new Date()
): Promise<MarketStatePayload> {
  const { data: sessionRow } = await supabase
    .from("market_sessions")
    .select("*")
    .eq("status", "live")
    .maybeSingle();
  if (!sessionRow) return { status: "closed" };

  let session = sessionRow as MarketSessionRow;
  await maybeRunMarketTick(supabase, session, now);

  const [{ data: refreshed }, { data: instrumentRows }] = await Promise.all([
    supabase.from("market_sessions").select("*").eq("id", session.id).maybeSingle(),
    supabase
      .from("market_instruments")
      .select("*, menu_items(menu_categories(name, display_order))")
      .eq("session_id", session.id)
      .order("display_name", { ascending: true }),
  ]);
  if (refreshed) session = refreshed as MarketSessionRow;

  const instruments = (instrumentRows ?? []) as MarketInstrumentWithCategoryRow[];
  const config = resolveMarketConfig(session.config);
  const crashActive =
    session.crash_until_tick != null && session.tick_no <= session.crash_until_tick;

  const { data: tickRows } = await supabase
    .from("market_ticks")
    .select("instrument_id, tick_no, price")
    .eq("session_id", session.id)
    .gt("tick_no", session.tick_no - SPARK_TICKS)
    .order("tick_no", { ascending: true });

  const sparkByInstrument = new Map<number, number[]>();
  for (const tick of tickRows ?? []) {
    const spark = sparkByInstrument.get(tick.instrument_id) ?? [];
    spark.push(Number(tick.price));
    sparkByInstrument.set(tick.instrument_id, spark);
  }

  let eventsQuery = supabase
    .from("market_events")
    .select("*")
    .eq("session_id", session.id)
    .order("id", { ascending: false })
    .limit(20);
  if (sinceEventId != null) eventsQuery = eventsQuery.gt("id", sinceEventId);
  const { data: eventRows } = await eventsQuery;

  return {
    status: "live",
    sessionId: session.id,
    tickNo: session.tick_no,
    tickIntervalSec: config.tickIntervalSec,
    crashActive,
    ...(crashActive ? { crashRemainingSec: crashRemainingSeconds(session, config, now) } : {}),
    instruments: instruments.map((row) => {
      const price = Number(row.current_price);
      const opening = Number(row.opening_price);
      const basePrice = Number(row.base_price);
      const spark = sparkByInstrument.get(row.id) ?? [];
      const previous = spark.length > 1 ? spark[spark.length - 2] : opening;
      const category = instrumentCategory(row);
      return {
        id: row.id,
        name: row.display_name,
        serve: row.serve,
        price,
        basePrice,
        changePct: opening > 0 ? Math.round(((price - opening) / opening) * 1000) / 10 : 0,
        direction: price > previous ? "up" : price < previous ? "down" : "flat",
        stock: row.stock_state,
        spark,
        category: category.name,
        categoryOrder: category.order,
        demandUnits: Number(row.demand_units),
        floor: Math.round(basePrice * config.floorPct * 100) / 100,
        ceil: Math.round(basePrice * config.ceilPct * 100) / 100,
      };
    }),
    events: (eventRows ?? [])
      .map((row) => {
        const payload = (row.payload ?? {}) as {
          name?: string;
          serve?: string;
          from?: number;
          to?: number;
          pct?: number;
        };
        return {
          id: row.id as number,
          kind: row.kind as MarketEventKind,
          name: payload.name ?? null,
          serve: payload.serve ?? null,
          from: payload.from ?? null,
          to: payload.to ?? null,
          pct: payload.pct ?? null,
          at: row.created_at as string,
        };
      })
      .reverse(),
  };
}
