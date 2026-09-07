import type { SupabaseClient } from "@supabase/supabase-js";
import { formatGbp } from "@/lib/price";
import { readVapidKeys, sendWebPush } from "@/lib/push/web-push";
import type { MarketEventKind } from "./types";

export type MarketPushEvent = {
  instrument_id: number | null;
  kind: MarketEventKind;
  payload: {
    name?: string | null;
    serve?: string | null;
    to?: number | null;
    pct?: number | null;
  };
};

type SubscriptionRow = {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  watched_instrument_ids: number[] | null;
};

const PUSH_KINDS = new Set<MarketEventKind>(["price_drop", "crash", "low_stock", "out_of_stock"]);
const MAX_LINES = 3;

function eventLine(event: MarketPushEvent): string {
  const name = [event.payload.name, event.payload.serve && event.payload.serve !== "each" ? event.payload.serve : null]
    .filter(Boolean)
    .join(" · ");
  switch (event.kind) {
    case "price_drop":
      return `${name} down to ${formatGbp(event.payload.to ?? 0)}${
        event.payload.pct != null ? ` (${event.payload.pct.toFixed(1)}%)` : ""
      }`;
    case "low_stock":
      return `${name} running low`;
    case "out_of_stock":
      return `${name} sold out`;
    case "crash":
      return name ? `${name} crashing - buy the dip` : "Market crash - every drink at its floor price";
    default:
      return name;
  }
}

function relevantTo(subscription: SubscriptionRow, events: MarketPushEvent[]): MarketPushEvent[] {
  const watched = subscription.watched_instrument_ids ?? [];
  if (watched.length === 0) return events;
  return events.filter(
    (event) =>
      event.kind === "crash" || (event.instrument_id != null && watched.includes(event.instrument_id))
  );
}

function notificationFor(events: MarketPushEvent[]) {
  const lines = events.map(eventLine);
  const shown = lines.slice(0, MAX_LINES);
  const extra = lines.length - shown.length;
  return {
    title: events.some((event) => event.kind === "crash") ? "Market crash" : "Market Night",
    body: extra > 0 ? `${shown.join("\n")}\n+${extra} more` : shown.join("\n"),
    url: "/market",
    tag: "market-night",
  };
}

/* Fan a tick's alert-worthy events out to every registered phone. Dead
   endpoints (404/410 from the push service) are removed so they stop
   costing a request every tick; other failures are recorded on the row. */
export async function sendMarketPushAlerts(
  supabase: SupabaseClient,
  events: MarketPushEvent[]
): Promise<{ sent: number; removed: number; failed: number }> {
  const summary = { sent: 0, removed: 0, failed: 0 };
  const keys = readVapidKeys();
  if (!keys) return summary;

  const alerts = events.filter((event) => PUSH_KINDS.has(event.kind));
  if (alerts.length === 0) return summary;

  const { data, error } = await supabase
    .from("market_push_subscriptions")
    .select("id, endpoint, p256dh, auth, watched_instrument_ids");
  if (error) {
    console.error("[market] push subscriptions read failed:", error);
    return summary;
  }
  const subscriptions = (data ?? []) as SubscriptionRow[];
  if (subscriptions.length === 0) return summary;

  const now = new Date().toISOString();
  await Promise.all(
    subscriptions.map(async (subscription) => {
      const relevant = relevantTo(subscription, alerts);
      if (relevant.length === 0) return;
      try {
        const result = await sendWebPush(subscription, notificationFor(relevant), keys);
        if (result.ok) {
          summary.sent += 1;
          return;
        }
        if (result.gone) {
          const { error: deleteError } = await supabase
            .from("market_push_subscriptions")
            .delete()
            .eq("id", subscription.id);
          if (deleteError) console.error("[market] push subscription delete failed:", deleteError);
          summary.removed += 1;
          return;
        }
        summary.failed += 1;
        const { error: updateError } = await supabase
          .from("market_push_subscriptions")
          .update({ last_error: `${result.status} ${result.body}`.slice(0, 500), failed_at: now })
          .eq("id", subscription.id);
        if (updateError) console.error("[market] push subscription update failed:", updateError);
      } catch (err) {
        summary.failed += 1;
        console.error("[market] push send failed:", err);
      }
    })
  );
  return summary;
}
