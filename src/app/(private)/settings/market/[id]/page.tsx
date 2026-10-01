import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminPageTitle from "@/components/admin/page-title";
import {
  summariseEvent,
  type StockMarketEventRow,
} from "@/lib/market/stock-market-events";
import { withSquareMixers } from "@/lib/market/square-mixers";
import { untrackedVariationIds } from "@/lib/market/square-stock-tracking";
import { readSquareVariationDetails, type SquareVariationDetail } from "@/lib/market/square-variation-details";
import { serveOptionsFromCategories, type ServeCategoryRow } from "@/lib/market/event-serves";
import {
  EMPTY_OVERRIDES,
  optionalNumber,
  overridesFromRow,
  tradingBasePrice,
  type DrinkOverrideRow,
  type DrinkOverrides,
} from "@/lib/market/drink-overrides";
import { eventReadiness } from "@/lib/market/event-readiness";
import { lastSalesSyncAt } from "@/lib/market/normal-units-server";
import type { NormalUnitsView } from "./normal-units-card";
import EventDetailClient, {
  type AvailableDrink,
  type EventDrink,
  type EventSession,
} from "./event-detail-client";

export const dynamic = "force-dynamic";

type EventRow = StockMarketEventRow & {
  stock_market_event_items:
    | ({
        menu_item_price_id: number;
        normal_units_per_night?: number | string | null;
        normal_units_keep?: boolean | null;
        display_name?: string | null;
      } & DrinkOverrideRow)[]
    | null;
};

const EVENT_SELECT =
  "*, stock_market_event_items(menu_item_price_id, opening_price, min_price, max_price, crash_price, low_stock_at, alert_threshold, normal_units_per_night, normal_units_keep, display_name)";

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
  with_mixer: boolean | null;
  created_at?: string | null;
  created_by?: number | null;
  updated_at?: string | null;
  updated_by?: number | null;
  menu_items: ItemJoin | ItemJoin[];
};

const SERVE_SELECT =
  "*, menu_items(id, name, is_active, menu_categories(id, name, display_order, market_only))";

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
        "id, name, display_order, menu_items(id, name, is_active, menu_item_prices(*))",
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
      .select("id, stock_market_event_id")
      .eq("status", "live")
      .maybeSingle(),
  ]);

  const isLive = liveRow?.stock_market_event_id === id;

  const employeeIds = [
    ...new Set(
      ((serveRows ?? []) as EventServeRow[]).flatMap((serve) =>
        [serve.created_by, serve.updated_by].filter((employeeId): employeeId is number => employeeId != null),
      ),
    ),
  ];
  const { data: employeeRows } = employeeIds.length
    ? await supabase.from("employees").select("id, full_name").in("id", employeeIds)
    : { data: [] as { id: number; full_name: string | null }[] };
  const employeeName = new Map(
    ((employeeRows ?? []) as { id: number; full_name: string | null }[]).map((employee) => [
      employee.id,
      employee.full_name ?? `Staff #${employee.id}`,
    ]),
  );

  const unpricedDrinks: EventDrink[] = ((serveRows ?? []) as EventServeRow[])
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
          menuPrice: amount > 0 ? amount : null,
          basePrice: amount > 0 ? amount : null,
          basePriceFromSquare: false,
          normalUnitsOverride: null,
          normalUnitsKeep: false,
          displayName: item.name,
          audit: {
            createdAt: serve.created_at ?? null,
            createdBy: serve.created_by != null ? (employeeName.get(serve.created_by) ?? null) : null,
            updatedAt: serve.updated_at ?? null,
            updatedBy: serve.updated_by != null ? (employeeName.get(serve.updated_by) ?? null) : null,
          },
          linked: Boolean(serve.square_variation_id),
          squareVariationId: serve.square_variation_id ?? null,
          withMixer: Boolean(serve.with_mixer),
          squareMixerPrice: null,
          stockTracked: null,
          overrides: overridesByPrice.get(serve.id) ?? EMPTY_OVERRIDES,
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
  const [mixedDrinks, menuServes, untracked, squareDetails] = await Promise.all([
    withSquareMixers(supabase, unpricedDrinks),
    withSquareMixers(
      supabase,
      serveOptionsFromCategories((categoryRows ?? []) as ServeCategoryRow[]).filter((serve) => !inEvent.has(serve.id)),
    ),
    untrackedVariationIds(supabase, unpricedDrinks.map((drink) => drink.squareVariationId)),
    readSquareVariationDetails(
      supabase,
      unpricedDrinks.map((drink) => drink.squareVariationId),
    ).catch((err): Record<string, SquareVariationDetail> => {
      console.error("[market] Square variation details read failed:", err);
      return {};
    }),
  ]);
  const untrackedSet = new Set(untracked);
  const squarePriceOf = (variationId: string | null) => {
    const detail = variationId ? squareDetails[variationId] : undefined;
    return detail && !detail.deletedAt ? detail.price : null;
  };
  const eventItemByPrice = new Map((row.stock_market_event_items ?? []).map((item) => [item.menu_item_price_id, item]));
  const drinks: EventDrink[] = mixedDrinks.map((drink) => {
    const squarePrice = squarePriceOf(drink.squareVariationId);
    const basePrice = tradingBasePrice(drink.menuPrice, squarePrice);
    const eventItem = eventItemByPrice.get(drink.id);
    return {
      ...drink,
      normalUnitsOverride: optionalNumber(eventItem?.normal_units_per_night),
      normalUnitsKeep: Boolean(eventItem?.normal_units_keep),
      displayName: eventItem?.display_name?.trim() || drink.name,
      basePrice,
      basePriceFromSquare: basePrice != null && basePrice === squarePrice,
      ...(drink.squareVariationId ? { stockTracked: !untrackedSet.has(drink.squareVariationId) } : {}),
    };
  });
  const available: AvailableDrink[] = menuServes
    .map((serve) => ({
      id: serve.id,
      name: serve.name,
      categoryName: serve.categoryName,
      serve: serve.serve,
      basePrice: serve.amount,
      linked: serve.linked,
      withMixer: serve.withMixer,
      squareMixerPrice: serve.squareMixerPrice,
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

  const [{ data: normalRows }, salesSyncedAt] = await Promise.all([
    menuItemPriceIds.length
      ? supabase
          .from("market_normal_units")
          .select("menu_item_price_id, weekday, units_avg, nights_sampled, computed_at")
          .in("menu_item_price_id", menuItemPriceIds)
      : Promise.resolve({ data: [] as never[] }),
    lastSalesSyncAt(supabase),
  ]);
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
    salesSyncedAt,
    rows: drinks
      .filter((drink) => drink.basePrice != null)
      .map((drink) => ({
        menuItemPriceId: drink.id,
        name: drink.name,
        serve: drink.serve,
        linked: drink.linked,
        override: overrideByPrice.get(drink.id) ?? null,
        keep: drink.normalUnitsOverride != null && drink.normalUnitsKeep,
        byWeekday: normalsByPrice.get(drink.id) ?? [],
      })),
  };

  const readiness = eventReadiness({
    menuItemPriceIds,
    tradeableIds: drinks.filter((drink) => drink.basePrice != null).map((drink) => drink.id),
    linkedIds: drinks.filter((drink) => drink.linked).map((drink) => drink.id),
    normalsReadIds: [...normalsByPrice.keys()],
    normalsComputedAt: computedAt,
  });

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
        readiness={readiness}
        normalUnits={normalUnits}
        squareDetails={squareDetails}
        environment={process.env.SQUARE_ENVIRONMENT === "production" ? "production" : "sandbox"}
      />
    </>
  );
}
