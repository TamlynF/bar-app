import { createClient } from "@/lib/supabase/server";
import { resolveMarketConfig } from "@/lib/market/types";
import {
  summariseEvent,
  type StockMarketEventRow,
  type StockMarketEventSummary,
} from "@/lib/market/stock-market-events";
import MarketClient, {
  type CategoryOption,
  type DrinkOption,
  type EmployeeOption,
  type InstrumentSummary,
  type MappingRow,
  type SessionSummary,
} from "./market-client";

export const dynamic = "force-dynamic";

type CategoryRow = {
  id: number;
  name: string;
  is_active: boolean;
  menu_items: {
    id: number;
    name: string;
    is_active: boolean;
    menu_item_prices: {
      id: number;
      serve: string;
      amount: number | string;
      display_order: number;
      square_variation_id: string | null;
    }[];
  }[];
};

type EventRow = StockMarketEventRow & {
  stock_market_event_items: { menu_item_id: number }[] | null;
};

export default async function MarketSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const supabase = await createClient();
  const { edit } = await searchParams;

  const [
    { data: sessionRow },
    { data: categoryRows },
    { data: eventRows },
    { data: runRows },
    { data: employees },
  ] = await Promise.all([
    supabase.from("market_sessions").select("*").eq("status", "live").maybeSingle(),
    supabase
      .from("menu_categories")
      .select(
        "id, name, is_active, menu_items(id, name, is_active, menu_item_prices(id, serve, amount, display_order, square_variation_id))"
      )
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
    supabase
      .from("stock_market_events")
      .select("*, stock_market_event_items(menu_item_id)")
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from("market_sessions")
      .select("stock_market_event_id, started_at")
      .not("stock_market_event_id", "is", null)
      .order("started_at", { ascending: false }),
    supabase.from("employees").select("id, full_name").order("full_name", { ascending: true }),
  ]);

  let session: SessionSummary | null = null;
  let instruments: InstrumentSummary[] = [];
  if (sessionRow) {
    session = {
      id: sessionRow.id,
      tickNo: sessionRow.tick_no,
      startedAt: sessionRow.started_at,
      crashUntilTick: sessionRow.crash_until_tick,
      config: resolveMarketConfig(sessionRow.config),
      stockMarketEventId: sessionRow.stock_market_event_id ?? null,
    };
    const { data: instrumentRows } = await supabase
      .from("market_instruments")
      .select("*")
      .eq("session_id", sessionRow.id)
      .order("display_name", { ascending: true });
    instruments = (instrumentRows ?? []).map((row) => ({
      id: row.id,
      name: row.display_name,
      serve: row.serve,
      basePrice: Number(row.base_price),
      currentPrice: Number(row.current_price),
      demandUnits: Number(row.demand_units),
      stockState: row.stock_state,
      stockOverride: row.stock_override,
      mapped: Boolean(row.square_variation_id),
    }));
  }

  const activeCategories = ((categoryRows ?? []) as CategoryRow[]).map((cat) => ({
    ...cat,
    menu_items: cat.menu_items.filter((item) => item.is_active),
  }));

  const categories: CategoryOption[] = activeCategories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    tradeableCount: cat.menu_items.filter((item) =>
      item.menu_item_prices.some((price) => Number(price.amount) > 0)
    ).length,
  }));

  const drinks: DrinkOption[] = activeCategories.flatMap((cat) =>
    cat.menu_items
      .filter((item) => item.menu_item_prices.some((price) => Number(price.amount) > 0))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((item) => ({ id: item.id, name: item.name, categoryId: cat.id, categoryName: cat.name }))
  );

  const mappingRows: MappingRow[] = activeCategories.flatMap((cat) =>
    cat.menu_items.flatMap((item) =>
      [...item.menu_item_prices]
        .sort((a, b) => a.display_order - b.display_order || a.id - b.id)
        .map((price, index) => ({
          menuItemPriceId: price.id,
          itemName: item.name,
          categoryName: cat.name,
          serve: price.serve,
          amount: Number(price.amount),
          isPrimary: index === 0,
          squareVariationId: price.square_variation_id,
        }))
    )
  );

  const lastRunByEvent = new Map<number, string>();
  for (const run of runRows ?? []) {
    if (run.stock_market_event_id == null || lastRunByEvent.has(run.stock_market_event_id)) continue;
    lastRunByEvent.set(run.stock_market_event_id, run.started_at);
  }

  const events: StockMarketEventSummary[] = ((eventRows ?? []) as EventRow[]).map((row) =>
    summariseEvent(
      row,
      (row.stock_market_event_items ?? []).map((item) => item.menu_item_id),
      lastRunByEvent.get(row.id) ?? null
    )
  );

  const editId = edit && /^\d+$/.test(edit) ? Number(edit) : null;

  return (
    <MarketClient
      session={session}
      instruments={instruments}
      categories={categories}
      drinks={drinks}
      events={events}
      employees={(employees ?? []) as EmployeeOption[]}
      mappingRows={mappingRows}
      initialEditId={editId}
    />
  );
}
