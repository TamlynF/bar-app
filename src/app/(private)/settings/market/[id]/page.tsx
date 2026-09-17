import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminPageTitle from "@/components/admin/page-title";
import {
  summariseEvent,
  type StockMarketEventRow,
} from "@/lib/market/stock-market-events";
import { resolveMarketConfig, type StockState } from "@/lib/market/types";
import { serveOptionsFromCategories, type ServeCategoryRow } from "@/lib/market/event-serves";
import {
  EMPTY_OVERRIDES,
  optionalNumber,
  overridesFromRow,
  type DrinkOverrideRow,
  type DrinkOverrides,
} from "@/lib/market/drink-overrides";
import type { NormalUnitsView } from "./normal-units-card";
import EventDetailClient, {
  type AvailableDrink,
  type EventDrink,
  type EventSession,
  type LiveInstrument,
} from "./event-detail-client";

export const dynamic = "force-dynamic";

type EventRow = StockMarketEventRow & {
  stock_market_event_items:
    | ({ menu_item_price_id: number; normal_units_per_night?: number | string | null } & DrinkOverrideRow)[]
    | null;
};

const EVENT_SELECT =
  "*, stock_market_event_items(menu_item_price_id, opening_price, min_price, max_price, crash_price, low_stock_at, alert_threshold, normal_units_per_night)";

type CategoryJoin = {
  id: number;
  name: string;
  display_order: number;
  market_only: boolean;
} | null;

type ItemJoin = {
  id: number;
  name: string;
  is_active: boolean;
  menu_categories: CategoryJoin | CategoryJoin[];
} | null;

/* One row per serve on the event, with its item and category joined. */
type EventServeRow = {
  id: number;
  menu_item_id: number;
  serve: string;
  amount: number | string;
  display_order: number;
  square_variation_id: string | null;
  menu_items: ItemJoin | ItemJoin[];
};

type InstrumentRow = {
  id: number;
  menu_item_price_id: number;
  opening_price: number | string;
  current_price: number | string;
  demand_units: number | string;
  stock_state: StockState;
  stock_override: StockState | null;
  crash_until_tick: number | null;
  pace: number | string | null;
  rank_pos: number | null;
  tier_pct: number | string | null;
  target_price: number | string | null;
  normal_units_per_night: number | string | null;
  normal_units_source: string | null;
};

const SERVE_SELECT =
  "id, menu_item_id, serve, amount, display_order, square_variation_id, menu_items(id, name, is_active, menu_categories(id, name, display_order, market_only))";

export default async function StockMarketEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  if (!/^\d+$/.test(rawId)) notFound();
  const id = Number(rawId);

  const supabase = await createClient();
  const { data: eventRow } = await supabase
    .from("stock_market_events")
    .select(EVENT_SELECT)
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();
  if (!eventRow) notFound();

  const row = eventRow as EventRow;
  const eventItems = row.stock_market_event_items ?? [];
  const menuItemPriceIds = eventItems.map((item) => item.menu_item_price_id);
  const overridesByPrice = new Map<number, DrinkOverrides>(
    eventItems.map((item) => [item.menu_item_price_id, overridesFromRow(item)]),
  );

  const [
    { data: serveRows },
    { data: categoryRows },
    { data: sessionRows },
    { data: liveRow },
  ] = await Promise.all([
    menuItemPriceIds.length > 0
      ? supabase.from("menu_item_prices").select(SERVE_SELECT).in("id", menuItemPriceIds)
      : Promise.resolve({ data: [] as EventServeRow[] }),
    supabase
      .from("menu_categories")
      .select(
        "id, name, display_order, menu_items(id, name, is_active, menu_item_prices(id, serve, amount, display_order, square_variation_id))",
      )
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
    supabase
      .from("market_sessions")
      .select("id, status, tick_no, started_at, ended_at")
      .eq("stock_market_event_id", id)
      .order("started_at", { ascending: false }),
    supabase
      .from("market_sessions")
      .select("id, stock_market_event_id, tick_no, config, warmed_up_tick, units_sold_total")
      .eq("status", "live")
      .maybeSingle(),
  ]);

  const isLive = liveRow?.stock_market_event_id === id;
  const { data: instrumentRows } = isLive
    ? await supabase
        .from("market_instruments")
        .select(
          "id, menu_item_price_id, opening_price, current_price, demand_units, stock_state, stock_override, crash_until_tick, pace, rank_pos, tier_pct, target_price, normal_units_per_night, normal_units_source",
        )
        .eq("session_id", liveRow!.id)
    : { data: [] as InstrumentRow[] };
  const instrumentsByPrice = new Map<number, LiveInstrument>(
    ((instrumentRows ?? []) as InstrumentRow[]).map((instrument) => [
      instrument.menu_item_price_id,
      {
        id: instrument.id,
        openingPrice: Number(instrument.opening_price),
        currentPrice: Number(instrument.current_price),
        demandUnits: Number(instrument.demand_units),
        stockState: instrument.stock_state,
        stockOverride: instrument.stock_override,
        crashing:
          instrument.crash_until_tick != null &&
          (liveRow?.tick_no ?? 0) <= instrument.crash_until_tick,
        pace: optionalNumber(instrument.pace),
        rankPos: instrument.rank_pos,
        tierPct: optionalNumber(instrument.tier_pct),
        targetPrice: optionalNumber(instrument.target_price),
        normalUnitsPerNight: optionalNumber(instrument.normal_units_per_night),
        normalUnitsSource: instrument.normal_units_source,
      },
    ]),
  );

  const drinks: EventDrink[] = ((serveRows ?? []) as EventServeRow[])
    .flatMap((serve) => {
      const item = Array.isArray(serve.menu_items) ? serve.menu_items[0] : serve.menu_items;
      if (!item) return [];
      const category = Array.isArray(item.menu_categories)
        ? item.menu_categories[0]
        : item.menu_categories;
      const amount = Number(serve.amount);
      return [
        {
          id: serve.id,
          menuItemId: item.id,
          name: item.name,
          isActive: item.is_active,
          categoryName: category?.market_only
            ? "Tonight only"
            : (category?.name ?? "The Bar"),
          categoryOrder: category?.market_only
            ? -1
            : (category?.display_order ?? Number.MAX_SAFE_INTEGER),
          nightOnly: Boolean(category?.market_only),
          serve: serve.serve,
          serveOrder: serve.display_order,
          basePrice: amount > 0 ? amount : null,
          linked: Boolean(serve.square_variation_id),
          squareVariationId: serve.square_variation_id ?? null,
          overrides: overridesByPrice.get(serve.id) ?? EMPTY_OVERRIDES,
          instrument: instrumentsByPrice.get(serve.id) ?? null,
        },
      ];
    })
    .sort(
      (a, b) =>
        a.categoryOrder - b.categoryOrder ||
        a.categoryName.localeCompare(b.categoryName) ||
        a.name.localeCompare(b.name) ||
        a.serveOrder - b.serveOrder ||
        a.id - b.id,
    );

  const inEvent = new Set(menuItemPriceIds);
  const available: AvailableDrink[] = serveOptionsFromCategories(
    (categoryRows ?? []) as ServeCategoryRow[],
  )
    .filter((serve) => !inEvent.has(serve.id))
    .map((serve) => ({
      id: serve.id,
      name: serve.name,
      categoryName: serve.categoryName,
      serve: serve.serve,
      basePrice: serve.amount,
      linked: serve.linked,
    }));

  const sessions: EventSession[] = (sessionRows ?? []).map((session) => ({
    id: session.id,
    status: session.status,
    tickNo: session.tick_no,
    startedAt: session.started_at,
    endedAt: session.ended_at,
  }));

  const lastRunAt = sessions[0]?.startedAt ?? null;
  const event = summariseEvent(row, menuItemPriceIds, lastRunAt);

  const { data: normalRows } = menuItemPriceIds.length
    ? await supabase
        .from("market_normal_units")
        .select("menu_item_price_id, weekday, units_avg, nights_sampled, computed_at")
        .in("menu_item_price_id", menuItemPriceIds)
    : { data: [] as never[] };
  const normalsByPrice = new Map<number, { weekday: number; unitsAvg: number; nightsSampled: number }[]>();
  let computedAt: string | null = null;
  for (const n of (normalRows ?? []) as {
    menu_item_price_id: number;
    weekday: number;
    units_avg: number | string;
    nights_sampled: number;
    computed_at: string;
  }[]) {
    const list = normalsByPrice.get(n.menu_item_price_id) ?? [];
    list.push({ weekday: n.weekday, unitsAvg: Number(n.units_avg), nightsSampled: n.nights_sampled });
    normalsByPrice.set(n.menu_item_price_id, list);
    if (!computedAt || n.computed_at > computedAt) computedAt = n.computed_at;
  }
  const overrideByPrice = new Map(
    (row.stock_market_event_items ?? []).map((item) => [item.menu_item_price_id, optionalNumber(item.normal_units_per_night)])
  );
  const normalUnits: NormalUnitsView = {
    eventId: event.id,
    weekdays: event.weekdays,
    computedAt,
    rows: drinks
      .filter((drink) => drink.basePrice != null)
      .map((drink) => ({
        menuItemPriceId: drink.id,
        name: drink.name,
        serve: drink.serve,
        linked: drink.linked,
        override: overrideByPrice.get(drink.id) ?? null,
        byWeekday: normalsByPrice.get(drink.id) ?? [],
      })),
  };

  return (
    <>
      <AdminPageTitle title={event.name} />
      <EventDetailClient
        event={event}
        drinks={drinks}
        available={available}
        sessions={sessions}
        isLive={isLive}
        anyLive={Boolean(liveRow)}
        normalUnits={normalUnits}
        liveTiers={
          isLive && liveRow
            ? {
                pricingMode: resolveMarketConfig(liveRow.config).pricingMode,
                warmedUp: liveRow.warmed_up_tick != null,
                unitsSoldTotal: Number(liveRow.units_sold_total ?? 0),
                warmupUnits: resolveMarketConfig(liveRow.config).warmupUnits,
              }
            : null
        }
      />
    </>
  );
}
