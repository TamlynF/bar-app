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
import SquareLinksClient, { type SaleLineCount } from "./square-links-client";

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

export default async function SquareLinksPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const supabase = await createClient();
  const { event } = await searchParams;

  const [
    { data: categoryRows },
    { data: eventRows },
    catalog,
    mixerChoice,
    modifierLists,
    { data: lineCountRows, error: lineCountError },
    { data: syncState },
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
      environment={
        process.env.SQUARE_ENVIRONMENT === "production"
          ? "production"
          : "sandbox"
      }
      untrackedVariationIds={catalog?.untrackedVariationIds ?? []}
      mixerChoice={mixerChoice}
      modifierLists={modifierLists}
      saleLineCounts={lineCountError ? null : saleLineCounts}
      salesSyncedAt={
        (syncState as { last_synced_at: string | null } | null)
          ?.last_synced_at ?? null
      }
      catalogSyncedAt={
        (syncState as { catalog_synced_at: string | null } | null)
          ?.catalog_synced_at ?? null
      }
    />
  );
}
