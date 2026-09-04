import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  summariseEvent,
  type StockMarketEventRow,
} from "@/lib/market/stock-market-events";
import type { StockState } from "@/lib/market/types";
import EventDetailClient, {
  type AvailableDrink,
  type EventDrink,
  type EventSession,
  type LiveInstrument,
} from "./event-detail-client";

export const dynamic = "force-dynamic";

type EventRow = StockMarketEventRow & {
  stock_market_event_items: { menu_item_id: number }[] | null;
};

type CategoryJoin = {
  id: number;
  name: string;
  display_order: number;
  market_only: boolean;
} | null;

type PriceRow = {
  id: number;
  serve: string;
  amount: number | string;
  display_order: number;
  square_variation_id: string | null;
};

type MenuItemRow = {
  id: number;
  name: string;
  is_active: boolean;
  menu_categories: CategoryJoin | CategoryJoin[];
  menu_item_prices: PriceRow[];
};

type CategoryRow = {
  id: number;
  name: string;
  display_order: number;
  menu_items: {
    id: number;
    name: string;
    is_active: boolean;
    menu_item_prices: PriceRow[];
  }[];
};

type InstrumentRow = {
  id: number;
  menu_item_id: number;
  opening_price: number | string;
  current_price: number | string;
  demand_units: number | string;
  stock_state: StockState;
  stock_override: StockState | null;
};

const ITEM_SELECT =
  "id, name, is_active, menu_categories(id, name, display_order, market_only), menu_item_prices(id, serve, amount, display_order, square_variation_id)";

function primaryPrice(prices: PriceRow[]): PriceRow | null {
  return (
    [...prices]
      .filter((price) => Number(price.amount) > 0)
      .sort((a, b) => a.display_order - b.display_order || a.id - b.id)[0] ??
    null
  );
}

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
    .select("*, stock_market_event_items(menu_item_id)")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();
  if (!eventRow) notFound();

  const row = eventRow as EventRow;
  const menuItemIds = (row.stock_market_event_items ?? []).map(
    (item) => item.menu_item_id,
  );

  const [
    { data: itemRows },
    { data: categoryRows },
    { data: sessionRows },
    { data: liveRow },
  ] = await Promise.all([
    menuItemIds.length > 0
      ? supabase.from("menu_items").select(ITEM_SELECT).in("id", menuItemIds)
      : Promise.resolve({ data: [] as MenuItemRow[] }),
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
      .select("id, stock_market_event_id")
      .eq("status", "live")
      .maybeSingle(),
  ]);

  const isLive = liveRow?.stock_market_event_id === id;
  const { data: instrumentRows } = isLive
    ? await supabase
        .from("market_instruments")
        .select(
          "id, menu_item_id, opening_price, current_price, demand_units, stock_state, stock_override",
        )
        .eq("session_id", liveRow!.id)
    : { data: [] as InstrumentRow[] };
  const instrumentsByItem = new Map<number, LiveInstrument>(
    ((instrumentRows ?? []) as InstrumentRow[]).map((instrument) => [
      instrument.menu_item_id,
      {
        id: instrument.id,
        openingPrice: Number(instrument.opening_price),
        currentPrice: Number(instrument.current_price),
        demandUnits: Number(instrument.demand_units),
        stockState: instrument.stock_state,
        stockOverride: instrument.stock_override,
      },
    ]),
  );

  const drinks: EventDrink[] = ((itemRows ?? []) as MenuItemRow[])
    .map((item) => {
      const category = Array.isArray(item.menu_categories)
        ? item.menu_categories[0]
        : item.menu_categories;
      const primary = primaryPrice(item.menu_item_prices);
      return {
        id: item.id,
        name: item.name,
        isActive: item.is_active,
        categoryName: category?.market_only
          ? "Tonight only"
          : (category?.name ?? "The Bar"),
        categoryOrder: category?.market_only
          ? -1
          : (category?.display_order ?? Number.MAX_SAFE_INTEGER),
        nightOnly: Boolean(category?.market_only),
        serve: primary?.serve ?? null,
        basePrice: primary ? Number(primary.amount) : null,
        linked: Boolean(primary?.square_variation_id),
        instrument: instrumentsByItem.get(item.id) ?? null,
      };
    })
    .sort(
      (a, b) =>
        a.categoryOrder - b.categoryOrder ||
        a.categoryName.localeCompare(b.categoryName) ||
        a.name.localeCompare(b.name),
    );

  const inEvent = new Set(menuItemIds);
  const available: AvailableDrink[] = (
    (categoryRows ?? []) as CategoryRow[]
  ).flatMap((cat) =>
    cat.menu_items
      .filter((item) => item.is_active && !inEvent.has(item.id))
      .map((item) => ({ item, primary: primaryPrice(item.menu_item_prices) }))
      .filter((entry) => entry.primary !== null)
      .map(({ item, primary }) => ({
        id: item.id,
        name: item.name,
        categoryName: cat.name,
        serve: primary!.serve,
        basePrice: Number(primary!.amount),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  const sessions: EventSession[] = (sessionRows ?? []).map((session) => ({
    id: session.id,
    status: session.status,
    tickNo: session.tick_no,
    startedAt: session.started_at,
    endedAt: session.ended_at,
  }));

  const lastRunAt = sessions[0]?.startedAt ?? null;
  const event = summariseEvent(row, menuItemIds, lastRunAt);

  return (
    <EventDetailClient
      event={event}
      drinks={drinks}
      available={available}
      sessions={sessions}
      isLive={isLive}
      anyLive={Boolean(liveRow)}
    />
  );
}
