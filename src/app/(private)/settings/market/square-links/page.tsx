import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  buildMappingRows,
  type MappingCategoryRow,
} from "@/lib/market/mapping-rows";
import { readCatalogCopy, readModifierListOptions } from "@/lib/market/catalog-copy";
import {
  readMixerChoice,
  type ModifierListOption,
} from "@/lib/market/square-mixers";
import {
  buildSquareItemRows,
  menuItemOptionsFrom,
  readCatalogItemCopy,
  readModifierListCopy,
  serveOptionsFrom,
  type ServeCategoryRow,
  type SquareItemRow,
} from "@/lib/market/square-item-rows";
import SquareLinksClient, { type SaleLineCount } from "./square-links-client";
import SquareItemsClient from "./square-items-client";
import SquareLinksTabs, { type SquareLinksView } from "./square-links-tabs";

export const dynamic = "force-dynamic";

type SaleLineCountRow = {
  variation_id: string;
  line_count: number;
  units: number | string | null;
  first_night: string | null;
  last_night: string | null;
};

type EventRow = {
  id: number;
  name: string;
  stock_market_event_items: { menu_item_price_id: number }[] | null;
};

type SyncStateRow = {
  last_synced_at: string | null;
  catalog_synced_at: string | null;
};

const ENVIRONMENT =
  process.env.SQUARE_ENVIRONMENT === "production" ? "production" : "sandbox";

async function readShared(supabase: SupabaseClient) {
  const [{ data: lineCountRows, error: lineCountError }, { data: syncState }] =
    await Promise.all([
      supabase
        .from("v_square_sale_line_counts")
        .select("variation_id, line_count, units, first_night, last_night"),
      supabase
        .from("square_sync_state")
        .select("last_synced_at, catalog_synced_at")
        .eq("id", 1)
        .maybeSingle(),
    ]);
  if (lineCountError)
    console.error("[market] sale line counts failed:", lineCountError);

  const saleLineCounts: Record<string, SaleLineCount> = Object.fromEntries(
    ((lineCountRows ?? []) as SaleLineCountRow[]).map((row) => [
      row.variation_id,
      {
        lines: row.line_count,
        units: Number(row.units ?? 0),
        firstNight: row.first_night,
        lastNight: row.last_night,
      },
    ]),
  );
  const state = syncState as SyncStateRow | null;
  return {
    saleLineCounts: lineCountError ? null : saleLineCounts,
    salesSyncedAt: state?.last_synced_at ?? null,
    catalogSyncedAt: state?.catalog_synced_at ?? null,
  };
}

async function SquareItemsView({ supabase }: { supabase: SupabaseClient }) {
  const [{ data: categoryRows }, copy, shared] = await Promise.all([
    supabase
      .from("menu_categories")
      .select(
        "id, name, is_active, menu_items(id, name, is_active, show_on_menu, menu_item_prices(id, serve, amount, display_order, square_variation_id, show_on_menu))",
      )
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
    Promise.all([readCatalogItemCopy(supabase), readModifierListCopy(supabase)]).catch(
      (err) => {
        console.error("[market] Square item copy read failed:", err);
        return null;
      },
    ),
    readShared(supabase),
  ]);

  const categories = (categoryRows ?? []) as ServeCategoryRow[];
  const serves = serveOptionsFrom(categories);
  const rows: SquareItemRow[] | null =
    copy && copy[0].length > 0 ? buildSquareItemRows(copy[0], copy[1], serves) : null;

  return (
    <SquareItemsClient
      rows={rows}
      serves={serves}
      items={menuItemOptionsFrom(categories)}
      categories={categories.map((category) => ({
        id: Number(category.id),
        name: category.name,
      }))}
      environment={ENVIRONMENT}
      {...shared}
    />
  );
}

async function MenuServesView({
  supabase,
  event,
}: {
  supabase: SupabaseClient;
  event: string | undefined;
}) {
  const [
    { data: categoryRows },
    { data: eventRows },
    catalog,
    mixerChoice,
    modifierLists,
    shared,
  ] = await Promise.all([
    supabase
      .from("menu_categories")
      .select(
        "id, name, is_active, menu_items(id, name, is_active, menu_item_prices(id, serve, amount, display_order, square_variation_id))",
      )
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
    supabase
      .from("stock_market_events")
      .select("id, name, stock_market_event_items(menu_item_price_id)")
      .eq("is_active", true)
      .order("name", { ascending: true }),
    readCatalogCopy(supabase),
    readMixerChoice(supabase),
    readModifierListOptions(supabase).then(
      (lists): ModifierListOption[] | null => lists,
      (err) => {
        console.error("[market] modifier list read failed:", err);
        return null;
      },
    ),
    readShared(supabase),
  ]);

  const events = ((eventRows ?? []) as EventRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    menuItemPriceIds: (row.stock_market_event_items ?? []).map(
      (item) => item.menu_item_price_id,
    ),
  }));
  const rows = buildMappingRows(
    (categoryRows ?? []) as MappingCategoryRow[],
    events,
  );

  const eventId = event && /^\d+$/.test(event) ? Number(event) : null;
  const focusEvent = events.find((row) => row.id === eventId) ?? null;

  return (
    <SquareLinksClient
      rows={rows}
      variations={catalog?.variations ?? null}
      focusEvent={focusEvent}
      itemIds={catalog?.itemIdByVariation ?? {}}
      environment={ENVIRONMENT}
      untrackedVariationIds={catalog?.untrackedVariationIds ?? []}
      mixerChoice={mixerChoice}
      modifierLists={modifierLists}
      {...shared}
    />
  );
}

export default async function SquareLinksPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string; view?: string }>;
}) {
  const supabase = await createClient();
  const { event, view: requested } = await searchParams;
  const view: SquareLinksView =
    requested === "menu" || requested === "items"
      ? requested
      : event
        ? "menu"
        : "items";

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 py-3 sm:py-0 2xl:max-w-[110rem]">
      <SquareLinksTabs view={view} />
      {view === "items" ? (
        <SquareItemsView supabase={supabase} />
      ) : (
        <MenuServesView supabase={supabase} event={event} />
      )}
    </div>
  );
}
