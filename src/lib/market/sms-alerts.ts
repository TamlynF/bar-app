import type { SupabaseClient } from "@supabase/supabase-js";
import { siteUrl } from "@/lib/site-url";
import { sendSms, smsAlertsEnabled } from "@/lib/sms/twilio";
import { tradingNightOf } from "./normal-units";
import { ALERT_KINDS, alertLine, relevantTo, type MarketPushEvent } from "./push-alerts";
import { marketSmsBody, textsLeftTonight } from "./sms-copy";

type SmsSubscriptionRow = {
  id: number;
  phone: string;
  stop_code: string;
  watched_instrument_ids: number[] | null;
  sent_night: string | null;
  sent_count: number;
};

export function stopTextsUrl(stopCode: string): string {
  return `${siteUrl()}/market/stop?t=${encodeURIComponent(stopCode)}`;
}

/* The "Stop texts" link in every alert carries the row's stop_code; a hit
   switches that phone off without needing a reply to the sender. */
export async function stopSmsByCode(supabase: SupabaseClient, code: string | null | undefined): Promise<boolean> {
  if (!code || !/^[0-9a-f]{12}$/i.test(code)) return false;
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("market_sms_subscriptions")
    .update({ opted_out_at: now, updated_at: now })
    .eq("stop_code", code.toLowerCase())
    .select("id");
  if (error) {
    console.error("[market] sms stop link failed:", error);
    return false;
  }
  return (data?.length ?? 0) > 0;
}

/* Text every verified phone that has something to hear about this tick. Each
   phone gets at most SMS_MAX_PER_NIGHT texts a trading night, and a number
   that has replied STOP (Twilio refuses the send) is marked opted out so it
   stops costing a request. */
export async function sendMarketSmsAlerts(
  supabase: SupabaseClient,
  events: MarketPushEvent[]
): Promise<{ sent: number; skipped: number; failed: number }> {
  const summary = { sent: 0, skipped: 0, failed: 0 };
  const alerts = events.filter((event) => ALERT_KINDS.has(event.kind));
  if (alerts.length === 0 || !smsAlertsEnabled()) return summary;

  const { data, error } = await supabase
    .from("market_sms_subscriptions")
    .select("id, phone, stop_code, watched_instrument_ids, sent_night, sent_count")
    .is("opted_out_at", null);
  if (error) {
    console.error("[market] sms subscriptions read failed:", error);
    return summary;
  }
  const subscriptions = (data ?? []) as SmsSubscriptionRow[];
  if (subscriptions.length === 0) return summary;

  const now = new Date();
  const tonight = tradingNightOf(now);
  const marketUrl = `${siteUrl()}/market`;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      const relevant = relevantTo(subscription, alerts);
      if (relevant.length === 0) return;
      if (textsLeftTonight(subscription.sent_night, subscription.sent_count, tonight) === 0) {
        summary.skipped += 1;
        return;
      }
      const body = marketSmsBody({
        lines: relevant.map(alertLine),
        marketUrl,
        stopUrl: stopTextsUrl(subscription.stop_code),
        crash: relevant.some((event) => event.kind === "crash"),
      });
      const sentCount = subscription.sent_night === tonight ? subscription.sent_count + 1 : 1;
      try {
        const result = await sendSms(subscription.phone, body);
        if (result.ok) {
          summary.sent += 1;
          const { error: updateError } = await supabase
            .from("market_sms_subscriptions")
            .update({ sent_night: tonight, sent_count: sentCount, last_error: null, failed_at: null, updated_at: now.toISOString() })
            .eq("id", subscription.id);
          if (updateError) console.error("[market] sms subscription update failed:", updateError);
          return;
        }
        summary.failed += 1;
        const { error: updateError } = await supabase
          .from("market_sms_subscriptions")
          .update({
            last_error: `${result.status} ${result.code ?? ""} ${result.message}`.slice(0, 500),
            failed_at: now.toISOString(),
            ...(result.optedOut ? { opted_out_at: now.toISOString() } : {}),
            updated_at: now.toISOString(),
          })
          .eq("id", subscription.id);
        if (updateError) console.error("[market] sms subscription update failed:", updateError);
      } catch (err) {
        summary.failed += 1;
        console.error("[market] sms send failed:", err);
      }
    })
  );
  console.info(
    `[market] sms alerts: ${alerts.length} event(s), ${subscriptions.length} phone(s), sent ${summary.sent}, capped ${summary.skipped}, failed ${summary.failed}`
  );
  return summary;
}
