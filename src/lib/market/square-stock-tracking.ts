import type { SupabaseClient } from "@supabase/supabase-js";
import type { Square } from "square";
import { readStockTracking } from "./catalog-copy";

/* Square's rule: a location override's track_inventory wins at that
   location, otherwise the variation's own flag; unset means not tracked. */
export function isStockTrackedAt(
  variation: Pick<Square.CatalogItemVariation, "trackInventory" | "locationOverrides"> | undefined,
  locationId: string
): boolean {
  const override = variation?.locationOverrides?.find((entry) => entry.locationId === locationId);
  if (override?.trackInventory != null) return override.trackInventory;
  return Boolean(variation?.trackInventory);
}

/* The linked variations Square does not track stock for, as the catalog
   copy has it, for the admin pages to flag before a market opens. Empty when
   the copy cannot be read. */
export async function untrackedVariationIds(
  supabase: SupabaseClient,
  variationIds: (string | null)[]
): Promise<string[]> {
  const ids = [...new Set(variationIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return [];
  try {
    const tracked = await readStockTracking(supabase, ids);
    return ids.filter((id) => tracked.get(id) === false);
  } catch (err) {
    console.error("[market] could not read stock tracking for the page:", err);
    return [];
  }
}

/* Records, per live drink, whether Square tracks its stock, from the catalog
   copy. Refresh the copy first when it must be current (opening, the catalog
   webhook); a drink missing from the copy keeps its flag (on open, null
   means counts are read as before). */
export async function refreshStockTracking(supabase: SupabaseClient, sessionId: number): Promise<number> {
  const { data, error } = await supabase
    .from("market_instruments")
    .select("id, square_variation_id, stock_tracked")
    .eq("session_id", sessionId)
    .not("square_variation_id", "is", null);
  if (error) throw error;
  const rows = (data ?? []) as { id: number; square_variation_id: string; stock_tracked: boolean | null }[];
  if (rows.length === 0) return 0;

  const tracked = await readStockTracking(
    supabase,
    rows.map((row) => row.square_variation_id)
  );

  const updates = rows.flatMap((row) => {
    const next = tracked.get(row.square_variation_id);
    return next === undefined || next === row.stock_tracked ? [] : [{ id: row.id, next }];
  });
  await Promise.all(
    updates.map(async (update) => {
      const { error: updateError } = await supabase
        .from("market_instruments")
        .update({ stock_tracked: update.next, ...(update.next ? {} : { stock_qty: null }) })
        .eq("id", update.id);
      if (updateError) console.error("[market] stock tracking write failed:", updateError);
    })
  );
  return updates.length;
}
