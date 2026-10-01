import type { SupabaseClient } from "@supabase/supabase-js";

export const LIVE_MARKET_MENU_MESSAGE =
  "A market is live - menu prices and Square pushes are locked until it closes, so the till and the board cannot fight over the same items.";

export async function liveMarketSessionId(supabase: SupabaseClient): Promise<number | null> {
  const { data } = await supabase
    .from("market_sessions")
    .select("id")
    .in("status", ["live", "closing"])
    .limit(1)
    .maybeSingle();
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

export const LIVE_MARKET_LINK_MESSAGE =
  "That serve is trading on tonight's market, so its Square link is locked until the market closes - changing it now would leave market prices on the till.";

/* Every serve the live (or closing) market holds an instrument for, including
   ones taken off the event mid-night: their till prices still need restoring. */
export async function tradingServeIds(supabase: SupabaseClient): Promise<Set<number>> {
  const { data: sessions } = await supabase
    .from("market_sessions")
    .select("id")
    .in("status", ["live", "closing"]);
  const ids = (sessions ?? []).map((row) => row.id as number);
  if (ids.length === 0) return new Set();
  const { data } = await supabase.from("market_instruments").select("menu_item_price_id").in("session_id", ids);
  return new Set((data ?? []).map((row) => row.menu_item_price_id as number));
}
