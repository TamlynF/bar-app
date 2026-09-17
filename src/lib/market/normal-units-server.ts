import type { SupabaseClient } from "@supabase/supabase-js";
import { squareClient } from "@/lib/square";
import { ensureBankHolidays } from "./bank-holidays";
import {
  aggregateUnits,
  describeSource,
  isBankHolidayNight,
  nightOf,
  profileWeekdayFor,
  resolveNormalUnits,
  sampleNightDates,
  summariseSamples,
  toYmd,
  tradingNightWindow,
  type NightSample,
  type NormalUnitsCache,
  type NormalUnitsRow,
  type OrderLike,
  type Ymd,
} from "./normal-units";
import type { MarketConfig } from "./types";

/* Square-facing side of "normal units per night" (plan §3.4). Runs on demand
   from the event editor and at session open when the cache is stale — never
   from the tick. One paginated orders.search per sampled night; a 42-drink
   event on two weekdays is a dozen calls. */

const STALE_AFTER_DAYS = 7;

export type NormalUnitsEventRow = {
  id: number;
  open_time: string;
  close_time: string;
  weekdays: number[] | null;
  bank_holiday_profile: number | null;
  history_from: string | null;
  history_to: string | null;
  exclude_market_nights: boolean | null;
};

export type OrdersSearch = (startIso: string, endIso: string) => Promise<OrderLike[]>;

export async function searchCompletedOrders(locationId: string, startIso: string, endIso: string): Promise<OrderLike[]> {
  const orders: OrderLike[] = [];
  let cursor: string | undefined;
  do {
    const res = await squareClient.orders.search({
      locationIds: [locationId],
      cursor,
      query: {
        filter: {
          stateFilter: { states: ["COMPLETED"] },
          dateTimeFilter: { closedAt: { startAt: startIso, endAt: endIso } },
        },
        sort: { sortField: "CLOSED_AT", sortOrder: "ASC" },
      },
      limit: 500,
    });
    orders.push(...((res.orders ?? []) as OrderLike[]));
    cursor = res.cursor;
  } while (cursor);
  return orders;
}

async function eventVariationMap(supabase: SupabaseClient, eventId: number): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("stock_market_event_items")
    .select("menu_item_price_id, menu_item_prices(id, square_variation_id)")
    .eq("event_id", eventId);
  if (error) throw error;
  const map = new Map<string, number>();
  for (const row of (data ?? []) as { menu_item_price_id: number; menu_item_prices: unknown }[]) {
    const joined = Array.isArray(row.menu_item_prices) ? row.menu_item_prices[0] : row.menu_item_prices;
    const variationId = (joined as { square_variation_id?: string | null } | null)?.square_variation_id;
    if (variationId) map.set(variationId, row.menu_item_price_id);
  }
  return map;
}

async function previousMarketNights(supabase: SupabaseClient): Promise<Set<Ymd>> {
  const { data } = await supabase.from("market_sessions").select("started_at");
  return new Set(((data ?? []) as { started_at: string }[]).map((r) => nightOf(new Date(r.started_at))));
}

export type RecalculateResult = {
  rows: NormalUnitsRow[];
  weekdays: number[];
  sampledNights: Record<number, Ymd[]>;
  unmappedServes: number;
};

export async function recalculateNormalUnits(
  supabase: SupabaseClient,
  event: NormalUnitsEventRow,
  options: { now?: Date; search?: OrdersSearch } = {}
): Promise<RecalculateResult> {
  const now = options.now ?? new Date();
  const locationId = process.env.SQUARE_LOCATION_ID;
  const search: OrdersSearch =
    options.search ??
    (async (startIso, endIso) => {
      if (!locationId) throw new Error("SQUARE_LOCATION_ID is not set.");
      return searchCompletedOrders(locationId, startIso, endIso);
    });

  const weekdays = (event.weekdays ?? []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  const priceIdByVariation = await eventVariationMap(supabase, event.id);
  const { count: serveCount } = await supabase
    .from("stock_market_event_items")
    .select("menu_item_price_id", { count: "exact", head: true })
    .eq("event_id", event.id);
  const unmappedServes = Math.max(0, (serveCount ?? 0) - new Set(priceIdByVariation.values()).size);

  const bankHolidays = await ensureBankHolidays(supabase, now);
  const marketNights = event.exclude_market_nights === false ? new Set<Ymd>() : await previousMarketNights(supabase);
  const today = toYmd(now);

  const rows: NormalUnitsRow[] = [];
  const sampledNights: Record<number, Ymd[]> = {};
  for (const weekday of weekdays) {
    const exclude = new Set<Ymd>(marketNights);
    const nights = sampleNightDates(weekday, {
      today,
      historyFrom: event.history_from,
      historyTo: event.history_to,
      exclude,
    }).filter((night) => !isBankHolidayNight(night, bankHolidays));
    sampledNights[weekday] = nights;

    const samples: NightSample[] = [];
    for (const night of nights) {
      const window = tradingNightWindow(night, event.open_time, event.close_time);
      const orders = await search(window.start.toISOString(), window.end.toISOString());
      samples.push({ night, units: aggregateUnits(orders, window) });
    }
    rows.push(...summariseSamples(weekday, samples, priceIdByVariation));
  }

  if (rows.length > 0) {
    const { error } = await supabase.from("market_normal_units").upsert(
      rows.map((r) => ({
        menu_item_price_id: r.menuItemPriceId,
        weekday: r.weekday,
        units_avg: r.unitsAvg,
        nights_sampled: r.nightsSampled,
        sampled_dates: r.sampledDates,
        computed_at: now.toISOString(),
      })),
      { onConflict: "menu_item_price_id,weekday" }
    );
    if (error) throw error;
  }
  return { rows, weekdays, sampledNights, unmappedServes };
}

type CacheRow = {
  menu_item_price_id: number;
  weekday: number;
  units_avg: number | string;
  nights_sampled: number;
  sampled_dates: string[] | null;
  computed_at: string;
};

export async function loadNormalUnitsCache(
  supabase: SupabaseClient,
  menuItemPriceIds: number[]
): Promise<{ cache: NormalUnitsCache; oldestComputedAt: Date | null }> {
  const cache: NormalUnitsCache = new Map();
  if (menuItemPriceIds.length === 0) return { cache, oldestComputedAt: null };
  const { data, error } = await supabase
    .from("market_normal_units")
    .select("menu_item_price_id, weekday, units_avg, nights_sampled, sampled_dates, computed_at")
    .in("menu_item_price_id", menuItemPriceIds);
  if (error) throw error;
  let oldest: Date | null = null;
  for (const row of (data ?? []) as CacheRow[]) {
    const list = cache.get(row.menu_item_price_id) ?? [];
    list.push({
      menuItemPriceId: row.menu_item_price_id,
      weekday: row.weekday,
      unitsAvg: Number(row.units_avg),
      nightsSampled: row.nights_sampled,
      sampledDates: row.sampled_dates ?? [],
    });
    cache.set(row.menu_item_price_id, list);
    const at = new Date(row.computed_at);
    if (!oldest || at < oldest) oldest = at;
  }
  return { cache, oldestComputedAt: oldest };
}

export function cacheIsStale(oldestComputedAt: Date | null, now: Date): boolean {
  if (!oldestComputedAt) return true;
  return now.getTime() - oldestComputedAt.getTime() > STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
}

export type ResolvedNormals = Map<number, { value: number; source: string }>;

/* Per-serve normal units for a session opening now: refreshes the cache when
   it is a week old (best effort), applies the bank-holiday profile to tonight,
   then override → weekday → other weekday → floor. */
export async function resolveNormalsForOpen(
  supabase: SupabaseClient,
  event: NormalUnitsEventRow,
  serves: { menuItemPriceId: number; override: number | null }[],
  config: Pick<MarketConfig, "paceFloorUnits">,
  now: Date = new Date()
): Promise<ResolvedNormals> {
  const ids = serves.map((s) => s.menuItemPriceId);
  const loaded = await loadNormalUnitsCache(supabase, ids);
  let cache = loaded.cache;
  if (cacheIsStale(loaded.oldestComputedAt, now) && (event.weekdays ?? []).length > 0) {
    try {
      await recalculateNormalUnits(supabase, event, { now });
      cache = (await loadNormalUnitsCache(supabase, ids)).cache;
    } catch (err) {
      console.error("[market] normal units refresh failed, using cache:", err);
    }
  }
  const bankHolidays = await ensureBankHolidays(supabase, now);
  const weekday = profileWeekdayFor(toYmd(now), bankHolidays, event.bank_holiday_profile);
  const out: ResolvedNormals = new Map();
  for (const serve of serves) {
    const resolved = resolveNormalUnits(serve.menuItemPriceId, weekday, serve.override, cache, config);
    out.set(serve.menuItemPriceId, { value: resolved.value, source: describeSource(resolved.source) });
  }
  return out;
}
