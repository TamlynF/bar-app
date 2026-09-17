import type { SupabaseClient } from "@supabase/supabase-js";

export const LIVE_MARKET_MENU_MESSAGE =
  "A market is live - menu prices and Square pushes are locked until it closes, so the till and the board cannot fight over the same items.";

export async function liveMarketSessionId(supabase: SupabaseClient): Promise<number | null> {
  const { data } = await supabase.from("market_sessions").select("id").eq("status", "live").maybeSingle();
  return data?.id ?? null;
}

/* True when any serve of this menu item is trading right now. */
export async function menuItemIsTrading(supabase: SupabaseClient, menuItemId: number): Promise<boolean> {
  const sessionId = await liveMarketSessionId(supabase);
  if (sessionId == null) return false;
  const { count } = await supabase
    .from("market_instruments")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("menu_item_id", menuItemId);
  return (count ?? 0) > 0;
}
