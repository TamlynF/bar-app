import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureBankHolidays } from "./bank-holidays";
import {
  describeSource,
  isBankHolidayNight,
  nightOf,
  profileWeekdayFor,
  resolveNormalUnits,
  sampleNightDates,
  samplesFromLines,
  summariseSamples,
  toYmd,
  type NormalUnitsCache,
  type NormalUnitsRow,
  type SaleLineLike,
  type Ymd,
} from "./normal-units";
import type { MarketConfig } from "./types";

/* Supabase side of "normal units per night" (plan §3.4). Reads the Square
   order lines the nightly sync keeps in square_sale_lines, so working the
   figures out is a local query and never a Square call. Runs on demand from
   the event page and again at session open. */

export type NormalUnitsEventRow = {
  id: number;
  weekdays: number[] | null;
  bank_holiday_profile: number | null;
  exclude_market_nights: boolean | null;
};

const PAGE = 1000;

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

/* Every synced line on the given nights, unfiltered by drink so a night
   with any sales at all reads as open. Paged past PostgREST's row cap. */
async function linesForNights(supabase: SupabaseClient, nights: Ymd[]): Promise<SaleLineLike[]> {
  if (nights.length === 0) return [];
  const lines: SaleLineLike[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("square_sale_lines")
      .select("trading_night, variation_id, quantity")
      .in("trading_night", nights)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as { trading_night: string; variation_id: string | null; quantity: number | string }[];
    for (const row of rows) {
      lines.push({ tradingNight: row.trading_night, variationId: row.variation_id, quantity: row.quantity });
    }
    if (rows.length < PAGE) break;
  }
  return lines;
}

export async function lastSalesSyncAt(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase.from("square_sync_state").select("last_synced_at").eq("id", 1).maybeSingle();
  return (data as { last_synced_at: string | null } | null)?.last_synced_at ?? null;
}

export type RecalculateResult = {
  rows: NormalUnitsRow[];
  weekdays: number[];
  sampledNights: Record<number, Ymd[]>;
  unmappedServes: number;
  lastSyncedAt: string | null;
};

export async function recalculateNormalUnits(
  supabase: SupabaseClient,
  event: NormalUnitsEventRow,
  options: { now?: Date } = {}
): Promise<RecalculateResult> {
  const now = options.now ?? new Date();
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
    const nights = sampleNightDates(weekday, { today, exclude: new Set(marketNights) }).filter(
      (night) => !isBankHolidayNight(night, bankHolidays)
    );
    sampledNights[weekday] = nights;
    const samples = samplesFromLines(nights, await linesForNights(supabase, nights));
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
  return { rows, weekdays, sampledNights, unmappedServes, lastSyncedAt: await lastSalesSyncAt(supabase) };
}

type CacheRow = {
  menu_item_price_id: number;
  weekday: number;
  units_avg: number | string;
  nights_sampled: number;
  sampled_dates: string[] | null;
};

export async function loadNormalUnitsCache(
  supabase: SupabaseClient,
  menuItemPriceIds: number[]
): Promise<NormalUnitsCache> {
  const cache: NormalUnitsCache = new Map();
  if (menuItemPriceIds.length === 0) return cache;
  const { data, error } = await supabase
    .from("market_normal_units")
    .select("menu_item_price_id, weekday, units_avg, nights_sampled, sampled_dates")
    .in("menu_item_price_id", menuItemPriceIds);
  if (error) throw error;
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
  }
  return cache;
}

export type ResolvedNormals = Map<number, { value: number; source: string }>;

/* Per-serve normal units for a session opening now: works the figures out
   afresh from the synced lines (best effort, the last computed set stands
   if that fails), applies the bank-holiday profile to tonight, then
   override → weekday → other weekday → floor. */
export async function resolveNormalsForOpen(
  supabase: SupabaseClient,
  event: NormalUnitsEventRow,
  serves: { menuItemPriceId: number; override: number | null }[],
  config: Pick<MarketConfig, "paceFloorUnits">,
  now: Date = new Date()
): Promise<ResolvedNormals> {
  if ((event.weekdays ?? []).length > 0) {
    try {
      await recalculateNormalUnits(supabase, event, { now });
    } catch (err) {
      console.error("[market] normal units recalculation failed, using the last set:", err);
    }
  }
  const cache = await loadNormalUnitsCache(
    supabase,
    serves.map((s) => s.menuItemPriceId)
  );
  const bankHolidays = await ensureBankHolidays(supabase, now);
  const weekday = profileWeekdayFor(toYmd(now), bankHolidays, event.bank_holiday_profile);
  const out: ResolvedNormals = new Map();
  for (const serve of serves) {
    const resolved = resolveNormalUnits(serve.menuItemPriceId, weekday, serve.override, cache, config);
    out.set(serve.menuItemPriceId, { value: resolved.value, source: describeSource(resolved.source) });
  }
  return out;
}
