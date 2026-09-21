import type { SupabaseClient } from "@supabase/supabase-js";
import { squareClient } from "@/lib/square";
import { instrumentLimits, runTick } from "./engine";
import { runTierTick, type TierInstrumentTickResult } from "./tier-engine";
import { publicTillPrice } from "./square-confirmation";
import { optionalNumber } from "./drink-overrides";
import { tickRng } from "./rng";
import { syncMarketPricesToSquare } from "./square-price-sync";
import {
  resolveMarketConfig,
  type InstrumentState,
  type MarketConfig,
  type InstrumentTickResult,
  type MarketEventKind,
  type PricingMode,
  type StockState,
} from "./types";
import { sendMarketPushAlerts } from "./push-alerts";
import { mergeUnits, sumPendingUnits, type SimSaleRow } from "./simulate";

export type MarketSessionRow = {
  id: number;
  status: string;
  config: unknown;
  tick_no: number;
  last_tick_at: string | null;
  orders_watermark: string | null;
  crash_until_tick: number | null;
  started_at: string;
  stock_market_event_id?: number | null;
  units_sold_total?: number | null;
  warmed_up_tick?: number | null;
  last_rerank_tick?: number | null;
  square_last_write_at?: string | null;
  square_catalog_confirmed_at?: string | null;
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
  stock_qty: number | string | null;
  square_variation_id: string | null;
  min_price: number | string | null;
  max_price: number | string | null;
  crash_price: number | string | null;
  low_stock_at: number | string | null;
  alert_threshold: number | string | null;
  crash_until_tick: number | null;
  square_original_price: number | string | null;
  square_synced_price: number | string | null;
  square_sync_error: string | null;
  square_confirmed_price?: number | string | null;
  normal_units_per_night?: number | string | null;
  normal_units_source?: string | null;
  pace?: number | string | null;
  last_sale_tick?: number | null;
  rank_pos?: number | null;
  tier_pct?: number | string | null;
  target_price?: number | string | null;
  units_sold?: number | string | null;
  high_price?: number | string | null;
  low_price?: number | string | null;
  tier_changes?: number | null;
  price_changes?: number | null;
};

export function instrumentCrashActive(row: MarketInstrumentRow, tickNo: number): boolean {
  return row.crash_until_tick != null && tickNo <= row.crash_until_tick;
}

export type MarketInstrumentPayload = {
  id: number;
  name: string;
  serve: string;
  price: number;
  basePrice: number;
  openingPrice: number;
  changePct: number;
  direction: "up" | "down" | "flat";
  stock: StockState;
  spark: number[];
  category: string | null;
  categoryOrder: number;
  demandUnits: number;
  floor: number;
  ceil: number;
  /* Price Square last acknowledged (what the till charges). Null when the
     drink is unlinked or the first write has not landed yet. Board/phone show
     this as the headline and `price` as the pending move when they differ. */
  tillPrice: number | null;
  tillSyncError: string | null;
  /* True when the drink is mapped to a Square variation, i.e. tillPrice is
     the price the bar actually charges once the first sync lands. */
  linkedToTill: boolean;
  /* Tier engine only; null in demand mode. */
  tierPct: number | null;
  targetPrice: number | null;
  pace: number | null;
  rankPos: number | null;
  normalUnitsPerNight: number | null;
  /* Square's IN_STOCK count at the last tick; null when unlinked or unknown. */
  stockQty: number | null;
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
  nextTickInSec?: number;
  tickLeadSec?: number;
  crashActive?: boolean;
  crashRemainingSec?: number;
  pushAlertsEnabled?: boolean;
  pricingMode?: PricingMode;
  warmedUp?: boolean;
  unitsSoldTotal?: number;
  warmupUnits?: number;
  nextRerankInSec?: number | null;
  leaderboardRows?: number;
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

function secondsUntilNextTick(session: MarketSessionRow, config: MarketConfig, now: Date): number {
  if (!session.last_tick_at) return config.tickIntervalSec;
  const sinceLastTick = (now.getTime() - new Date(session.last_tick_at).getTime()) / 1000;
  return Math.max(0, Math.ceil(config.tickIntervalSec - sinceLastTick));
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
    minPrice: optionalNumber(row.min_price),
    maxPrice: optionalNumber(row.max_price),
    crashPrice: optionalNumber(row.crash_price),
    lowStockAt: optionalNumber(row.low_stock_at),
    alertThreshold: optionalNumber(row.alert_threshold),
    normalUnitsPerNight: optionalNumber(row.normal_units_per_night),
    lastSaleTick: row.last_sale_tick ?? null,
    tierPct: optionalNumber(row.tier_pct) ?? 0,
  };
}

function secondsUntilNextRerank(session: MarketSessionRow, config: MarketConfig, now: Date): number | null {
  if (config.pricingMode !== "tiers" || session.warmed_up_tick == null) return null;
  const every = Math.max(1, Math.round(config.rerankEveryTicks));
  const ticksLeft = every - (session.tick_no % every);
  return (ticksLeft - 1) * config.tickIntervalSec + secondsUntilNextTick(session, config, now);
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

/* The serves (menu_item_price ids) on the session's event, or null when the
   session predates events and every instrument counts. */
async function eventServeIds(
  supabase: SupabaseClient,
  session: MarketSessionRow
): Promise<Set<number> | null> {
  if (session.stock_market_event_id == null) return null;
  const { data } = await supabase
    .from("stock_market_event_items")
    .select("menu_item_price_id")
    .eq("event_id", session.stock_market_event_id);
  return new Set(
    ((data ?? []) as { menu_item_price_id: number }[]).map((row) => row.menu_item_price_id)
  );
}

/* How early a tick may start ahead of its due time. The engine, the Square
   catalog write and the confirming webhook all run inside this lead, so the
   new prices are already the till's prices when the board's countdown lands;
   the board holds them back until then. Short intervals get a shorter lead. */
const TICK_LEAD_SEC = 8;

export function tickLeadSec(config: MarketConfig): number {
  return Math.max(0, Math.min(TICK_LEAD_SEC, Math.floor(config.tickIntervalSec / 4)));
}

/* The winner of the compare-and-swap on last_tick_at runs one engine tick;
   everyone else reads the state as-is. Square being down degrades to a pure
   random-walk tick rather than freezing the board. A tick claimed inside the
   lead is stamped with its due time, not the claim time, so the countdown
   grid holds still and the next tick is not pulled earlier every cycle. */
export async function maybeRunMarketTick(
  supabase: SupabaseClient,
  session: MarketSessionRow,
  now: Date = new Date()
): Promise<void> {
  const config = resolveMarketConfig(session.config);
  const lastTick = session.last_tick_at ? new Date(session.last_tick_at) : null;
  const due = lastTick ? lastTick.getTime() + config.tickIntervalSec * 1000 : now.getTime();
  if (now.getTime() < due - tickLeadSec(config) * 1000) return;
  const stamp = new Date(Math.max(due, now.getTime()));

  /* tick_no equality is the compare-and-swap: a competing request that won
     already incremented it, so everyone else matches zero rows and reads. */
  const { data: won, error: casError } = await supabase
    .from("market_sessions")
    .update({ last_tick_at: stamp.toISOString(), tick_no: session.tick_no + 1 })
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
    const [{ data: instrumentRows, error }, onEvent] = await Promise.all([
      supabase.from("market_instruments").select("*").eq("session_id", session.id),
      eventServeIds(supabase, session),
    ]);
    if (error) throw error;
    /* Only serves still on the event move. A serve staff removed mid-session
       keeps its row (history, till restore at close) but stops trading. */
    const instruments = ((instrumentRows ?? []) as MarketInstrumentRow[]).filter(
      (row) => onEvent == null || onEvent.has(row.menu_item_price_id)
    );
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

    let newUnitsByInstrument = new Map<number, number>();
    for (const instrument of instruments) {
      if (!instrument.square_variation_id) continue;
      const units = unitsByVariation.get(instrument.square_variation_id);
      if (units) newUnitsByInstrument.set(instrument.id, units);
    }

    /* Simulated sales (admin "Simulate sales" panel) are a second demand
       feed on top of the till. Rows are claimed by id so a sale rung up
       between this read and the update below is simply picked up next tick
       rather than lost or double-counted. */
    const { data: simRows, error: simError } = await supabase
      .from("market_sim_sales")
      .select("id, instrument_id, units")
      .eq("session_id", session.id)
      .is("consumed_tick_no", null);
    if (simError) console.error("[market] simulated sales read failed:", simError);
    const pendingSim = (simRows ?? []) as (SimSaleRow & { id: number })[];
    if (pendingSim.length > 0) {
      newUnitsByInstrument = mergeUnits(newUnitsByInstrument, sumPendingUnits(pendingSim));
    }

    const crashActive =
      session.crash_until_tick != null && tickNo <= session.crash_until_tick;

    const states = instruments.map((row) => ({
      ...toInstrumentState(row),
      crashActive: instrumentCrashActive(row, tickNo),
    }));
    const tickInputs = {
      config,
      crashActive,
      newUnitsByInstrument,
      stockQtyByVariation,
      rng: tickRng(session.id, tickNo),
    };
    let results: (InstrumentTickResult | TierInstrumentTickResult)[];
    let sessionUpdate: Record<string, unknown> = {};
    const sessionEvents: { kind: MarketEventKind; payload: Record<string, unknown> }[] = [];
    if (config.pricingMode === "tiers") {
      const outcome = runTierTick(states, {
        ...tickInputs,
        session: {
          tickNo,
          unitsSoldTotal: session.units_sold_total ?? 0,
          warmedUpTick: session.warmed_up_tick ?? null,
          lastRerankTick: session.last_rerank_tick ?? null,
        },
      });
      results = outcome.results;
      sessionUpdate = {
        units_sold_total: outcome.session.unitsSoldTotal,
        warmed_up_tick: outcome.session.warmedUpTick,
        last_rerank_tick: outcome.session.lastRerankTick,
      };
      if (outcome.warmedUpThisTick) sessionEvents.push({ kind: "warmup_done", payload: {} });
      if (outcome.reranked) sessionEvents.push({ kind: "rerank", payload: {} });
    } else {
      results = runTick(states, tickInputs);
    }

    const byId = new Map(instruments.map((i) => [i.id, i] as const));
    const instrumentPatch = (result: (typeof results)[number], withStats: boolean) => {
      const row = byId.get(result.id);
      const variationId = row?.square_variation_id;
      const stockQty = variationId ? stockQtyByVariation.get(variationId) : undefined;
      const tier = "tierPct" in result ? result : null;
      return {
        current_price: result.price,
        demand_units: result.demandUnits,
        stock_state: result.stockState,
        last_notified_price: result.lastNotifiedPrice,
        updated_at: now.toISOString(),
        ...(stockQty === undefined ? {} : { stock_qty: stockQty }),
        ...(tier
          ? {
              pace: tier.pace,
              last_sale_tick: tier.lastSaleTick,
              rank_pos: tier.rankPos,
              tier_pct: tier.tierPct,
              target_price: Math.round(tier.targetPrice * 100) / 100,
            }
          : {}),
        ...(withStats && row ? sessionStats(row, result) : {}),
      };
    };
    const runUpdates = (withStats: boolean) =>
      Promise.all(
        results.map((result) =>
          supabase.from("market_instruments").update(instrumentPatch(result, withStats)).eq("id", result.id)
        )
      );
    /* The running totals arrived in a later migration; until it has run on
       this database the tick still updates the drink as before. */
    let updateResults = await runUpdates(true);
    if (updateResults.some(({ error: updateError }) => updateError && isMissingColumn(updateError))) {
      updateResults = await runUpdates(false);
    }
    for (const { error: updateError } of updateResults) {
      if (updateError) throw updateError;
    }
    if (Object.keys(sessionUpdate).length > 0) {
      const { error: sessionError } = await supabase
        .from("market_sessions")
        .update(sessionUpdate)
        .eq("id", session.id);
      if (sessionError) throw sessionError;
    }

    const tickRows = results.map((result) => {
      const tier = "tierPct" in result ? result : null;
      return {
        session_id: session.id,
        instrument_id: result.id,
        tick_no: tickNo,
        price: result.price,
        units: result.units,
        demand_units: result.demandUnits,
        pace: tier?.pace ?? null,
        mins_since_sale: tier?.minsSinceSale ?? null,
        rank_value: tier ? Math.round(tier.rankValue * 1e7) / 1e7 : null,
        rank_pos: tier?.rankPos ?? null,
        tier_pct: tier?.tierPct ?? null,
        target_price: tier ? Math.round(tier.targetPrice * 100) / 100 : null,
      };
    });
    /* The breakdown columns arrived in a later migration; until it has run
       on this database the tick still records price and demand as before. */
    const { error: tickError } = await supabase
      .from("market_ticks")
      .upsert(tickRows, { onConflict: "instrument_id,tick_no", ignoreDuplicates: true });
    if (tickError && isMissingColumn(tickError)) {
      const { error: baseError } = await supabase.from("market_ticks").upsert(
        tickRows.map(({ session_id, instrument_id, tick_no, price, demand_units }) => ({
          session_id,
          instrument_id,
          tick_no,
          price,
          demand_units,
        })),
        { onConflict: "instrument_id,tick_no", ignoreDuplicates: true }
      );
      if (baseError) throw baseError;
    } else if (tickError) {
      throw tickError;
    }

    const events = [
      ...sessionEvents.map((event) => ({
        session_id: session.id,
        instrument_id: null as number | null,
        kind: event.kind,
        payload: event.payload,
      })),
      ...results.flatMap((result) =>
        result.events.map((event) => {
          const row = byId.get(event.instrumentId);
          return {
            session_id: session.id,
            instrument_id: event.instrumentId as number | null,
            kind: event.kind,
            payload: {
              name: row?.display_name ?? null,
              serve: row?.serve ?? null,
              ...event.payload,
            } as Record<string, unknown>,
          };
        })
      ),
    ];
    if (events.length > 0) {
      const { error: eventError } = await supabase.from("market_events").insert(events);
      if (eventError) throw eventError;
      if (config.pushAlertsEnabled) {
        try {
          await sendMarketPushAlerts(supabase, events);
        } catch (err) {
          console.error("[market] push alerts failed:", err);
        }
      }
    }

    if (newWatermark) {
      await supabase
        .from("market_sessions")
        .update({ orders_watermark: newWatermark.toISOString() })
        .eq("id", session.id);
    }

    if (pendingSim.length > 0) {
      const { error: consumeError } = await supabase
        .from("market_sim_sales")
        .update({ consumed_tick_no: tickNo })
        .in(
          "id",
          pendingSim.map((row) => row.id)
        );
      if (consumeError) console.error("[market] could not mark simulated sales consumed:", consumeError);
    }

    /* Write leg: push every price that moved this tick into Square in one
       batched catalog write. Runs last so the board state above is already
       committed, and is try/caught on its own so a Square outage can never
       undo a tick that has already happened. */
    try {
      const sync = await syncMarketPricesToSquare(supabase, session.id, tickNo);
      if (sync.retryLater) console.warn("[market] Square busy (429) - prices retry next tick");
      if (sync.errors.length > 0) {
        console.error("[market] Square price sync errors:", sync.errors);
      }
      await recordTillPrices(supabase, session.id, tickNo, tickRows);
    } catch (err) {
      console.error("[market] Square price sync failed:", err);
    }
  } catch (err) {
    console.error("[market] tick failed:", err);
  }
}

/* Workbook tab 10's per-drink summary columns, kept as running totals. A
   price change is any move of the board price; a tier change is the tier
   awarded this tick differing from the one before. */
function sessionStats(row: MarketInstrumentRow, result: InstrumentTickResult | TierInstrumentTickResult) {
  const previousPrice = Number(row.current_price);
  const previousTier = optionalNumber(row.tier_pct) ?? 0;
  const tier = "tierPct" in result ? result.tierPct : previousTier;
  const high = Math.max(optionalNumber(row.high_price) ?? Number(row.opening_price), previousPrice, result.price);
  const low = Math.min(optionalNumber(row.low_price) ?? Number(row.opening_price), previousPrice, result.price);
  return {
    units_sold: (optionalNumber(row.units_sold) ?? 0) + result.units,
    high_price: Math.round(high * 100) / 100,
    low_price: Math.round(low * 100) / 100,
    tier_changes: (row.tier_changes ?? 0) + (tier !== previousTier ? 1 : 0),
    price_changes: (row.price_changes ?? 0) + (result.price !== previousPrice ? 1 : 0),
  };
}

function isMissingColumn(error: { code?: string; message?: string }): boolean {
  return error.code === "PGRST204" || /column .* does not exist|Could not find the .* column/i.test(error.message ?? "");
}

/* After the write leg, note what the till is charging on each tick row so
   the breakdown can show board price and till price side by side. */
async function recordTillPrices(
  supabase: SupabaseClient,
  sessionId: number,
  tickNo: number,
  tickRows: { instrument_id: number; price: number; demand_units: number }[]
) {
  const { data } = await supabase
    .from("market_instruments")
    .select("id, square_synced_price")
    .eq("session_id", sessionId)
    .not("square_synced_price", "is", null);
  if (!data || data.length === 0) return;
  const synced = new Map(data.map((row) => [row.id as number, Number(row.square_synced_price)]));
  const updates = tickRows
    .filter((row) => synced.has(row.instrument_id))
    .map((row) => ({
      session_id: sessionId,
      instrument_id: row.instrument_id,
      tick_no: tickNo,
      price: row.price,
      demand_units: row.demand_units,
      till_price: synced.get(row.instrument_id),
    }));
  if (updates.length === 0) return;
  const { error } = await supabase.from("market_ticks").upsert(updates, { onConflict: "instrument_id,tick_no" });
  if (error) console.error("[market] till price note failed:", error);
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

  const [{ data: refreshed }, { data: instrumentRows }, onEvent] = await Promise.all([
    supabase.from("market_sessions").select("*").eq("id", session.id).maybeSingle(),
    supabase
      .from("market_instruments")
      .select("*, menu_items(menu_categories(name, display_order))")
      .eq("session_id", session.id)
      .order("display_name", { ascending: true }),
    eventServeIds(supabase, session),
  ]);
  if (refreshed) session = refreshed as MarketSessionRow;

  /* The board only lists serves still on the event: a serve staff remove
     from the event mid-session keeps its instrument row (so its history and
     till price survive) but drops off the phone page and the big screen. */
  const instruments = ((instrumentRows ?? []) as MarketInstrumentWithCategoryRow[]).filter(
    (row) => onEvent == null || onEvent.has(row.menu_item_price_id)
  );
  const shownInstrumentIds = new Set(instruments.map((row) => row.id));
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
    nextTickInSec: secondsUntilNextTick(session, config, now),
    tickLeadSec: tickLeadSec(config),
    crashActive,
    ...(crashActive ? { crashRemainingSec: crashRemainingSeconds(session, config, now) } : {}),
    pushAlertsEnabled: config.pushAlertsEnabled,
    pricingMode: config.pricingMode,
    warmedUp: config.pricingMode === "tiers" ? session.warmed_up_tick != null : true,
    unitsSoldTotal: session.units_sold_total ?? 0,
    warmupUnits: config.warmupUnits,
    nextRerankInSec: secondsUntilNextRerank(session, config, now),
    leaderboardRows: config.leaderboardRows,
    instruments: instruments.map((row) => {
      const price = Number(row.current_price);
      const opening = Number(row.opening_price);
      const basePrice = Number(row.base_price);
      const spark = sparkByInstrument.get(row.id) ?? [];
      const previous = spark.length > 1 ? spark[spark.length - 2] : opening;
      const category = instrumentCategory(row);
      const limits = instrumentLimits(toInstrumentState(row), config);
      return {
        id: row.id,
        name: row.display_name,
        serve: row.serve,
        price,
        basePrice,
        openingPrice: opening,
        changePct: opening > 0 ? Math.round(((price - opening) / opening) * 1000) / 10 : 0,
        direction: price > previous ? "up" : price < previous ? "down" : "flat",
        stock: row.stock_state,
        spark,
        category: category.name,
        categoryOrder: category.order,
        demandUnits: Number(row.demand_units),
        floor: Math.round(limits.floor * 100) / 100,
        ceil: Math.round(limits.ceil * 100) / 100,
        tillPrice: publicTillPrice(session, row),
        tillSyncError: row.square_sync_error ?? null,
        linkedToTill: Boolean(row.square_variation_id),
        tierPct: config.pricingMode === "tiers" ? (optionalNumber(row.tier_pct) ?? 0) : null,
        targetPrice: config.pricingMode === "tiers" ? optionalNumber(row.target_price) : null,
        pace: config.pricingMode === "tiers" ? (optionalNumber(row.pace) ?? 0) : null,
        rankPos: config.pricingMode === "tiers" ? (row.rank_pos ?? null) : null,
        normalUnitsPerNight: optionalNumber(row.normal_units_per_night),
        stockQty: row.stock_qty == null ? null : Number(row.stock_qty),
      };
    }),
    events: (eventRows ?? [])
      .filter((row) => row.instrument_id == null || shownInstrumentIds.has(row.instrument_id as number))
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
