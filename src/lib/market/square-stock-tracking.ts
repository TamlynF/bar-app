import type { SupabaseClient } from "@supabase/supabase-js";
import type { Square } from "square";
import { squareClient } from "@/lib/square";

type Variation = Extract<Square.CatalogObject, { type: "ITEM_VARIATION" }>;

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

const GET_LIMIT = 1000;

export async function fetchTrackedVariations(variationIds: string[], locationId: string): Promise<Map<string, boolean>> {
  const tracked = new Map<string, boolean>();
  for (let i = 0; i < variationIds.length; i += GET_LIMIT) {
    const res = await squareClient.catalog.batchGet({
      objectIds: variationIds.slice(i, i + GET_LIMIT),
      includeRelatedObjects: false,
      includeDeletedObjects: false,
    });
    for (const obj of res.objects ?? []) {
      if (obj.type !== "ITEM_VARIATION" || !obj.id) continue;
      tracked.set(obj.id, isStockTrackedAt((obj as Variation).itemVariationData, locationId));
    }
  }
  return tracked;
}

/* The linked variations Square does not track stock for, for the admin pages
   to flag before a market opens. Empty when Square cannot be read. */
export async function untrackedVariationIds(variationIds: (string | null)[]): Promise<string[]> {
  const locationId = process.env.SQUARE_LOCATION_ID;
  const ids = [...new Set(variationIds.filter((id): id is string => Boolean(id)))];
  if (!locationId || ids.length === 0) return [];
  try {
    const tracked = await fetchTrackedVariations(ids, locationId);
    return ids.filter((id) => tracked.get(id) === false);
  } catch (err) {
    console.error("[market] could not read stock tracking for the page:", err);
    return [];
  }
}

/* Records, per live drink, whether Square tracks its stock. Run at open and
   whenever Square says the catalog changed; an unreachable Square leaves the
   flags as they were (and on open, null means counts are read as before). */
export async function refreshStockTracking(
  supabase: SupabaseClient,
  sessionId: number,
  options: { requireSquare: boolean }
): Promise<number> {
  const locationId = process.env.SQUARE_LOCATION_ID;
  if (!locationId) return 0;
  const { data, error } = await supabase
    .from("market_instruments")
    .select("id, square_variation_id, stock_tracked")
    .eq("session_id", sessionId)
    .not("square_variation_id", "is", null);
  if (error) throw error;
  const rows = (data ?? []) as { id: number; square_variation_id: string; stock_tracked: boolean | null }[];
  if (rows.length === 0) return 0;

  let tracked: Map<string, boolean>;
  try {
    tracked = await fetchTrackedVariations([...new Set(rows.map((row) => row.square_variation_id))], locationId);
  } catch (err) {
    if (options.requireSquare) throw err;
    console.error("[market] could not read stock tracking from Square:", err);
    return 0;
  }

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
