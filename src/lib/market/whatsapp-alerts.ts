import type { SupabaseClient } from "@supabase/supabase-js";
import { siteUrl } from "@/lib/site-url";
import { readWhatsappEnv, sendWhatsapp, whatsappAlertsEnabled } from "@/lib/sms/twilio";
import { tradingNightOf } from "./normal-units";
import { ALERT_KINDS, alertLine, relevantTo, type MarketPushEvent } from "./push-alerts";
import { alertsLeftTonight } from "./alert-quota";
import { stopAlertsUrl } from "./alert-stop";
import { marketWhatsappBody, marketWhatsappTemplateVariables, WHATSAPP_MAX_PER_NIGHT } from "./whatsapp-copy";

type WhatsappSubscriptionRow = {
  id: number;
  phone: string;
  stop_code: string;
  watched_instrument_ids: number[] | null;
  sent_night: string | null;
  sent_count: number;
};

/* Message every verified WhatsApp number that has something to hear about
   this tick, at most WHATSAPP_MAX_PER_NIGHT times a trading night. With an
   approved content template configured the alert goes out as that template
   (required outside a 24-hour conversation); without one - the Twilio
   sandbox, or a reply window - it goes as free text. */
export async function sendMarketWhatsappAlerts(
  supabase: SupabaseClient,
  events: MarketPushEvent[]
): Promise<{ sent: number; skipped: number; failed: number }> {
  const summary = { sent: 0, skipped: 0, failed: 0 };
  const alerts = events.filter((event) => ALERT_KINDS.has(event.kind));
  if (alerts.length === 0 || !whatsappAlertsEnabled()) return summary;

  const { data, error } = await supabase
    .from("market_whatsapp_subscriptions")
    .select("id, phone, stop_code, watched_instrument_ids, sent_night, sent_count")
    .is("opted_out_at", null);
  if (error) {
    console.error("[market] whatsapp subscriptions read failed:", error);
    return summary;
  }
  const subscriptions = (data ?? []) as WhatsappSubscriptionRow[];
  if (subscriptions.length === 0) return summary;

  const now = new Date();
  const tonight = tradingNightOf(now);
  const marketUrl = `${siteUrl()}/market`;
  const templateSid = readWhatsappEnv()?.templateSid ?? null;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      const relevant = relevantTo(subscription, alerts);
      if (relevant.length === 0) return;
      if (alertsLeftTonight(subscription.sent_night, subscription.sent_count, tonight, WHATSAPP_MAX_PER_NIGHT) === 0) {
        summary.skipped += 1;
        return;
      }
      const copy = {
        lines: relevant.map(alertLine),
        crash: relevant.some((event) => event.kind === "crash"),
        marketUrl,
        stopUrl: stopAlertsUrl("whatsapp", subscription.stop_code),
      };
      const sentCount = subscription.sent_night === tonight ? subscription.sent_count + 1 : 1;
      try {
        const result = await sendWhatsapp(
          subscription.phone,
          templateSid
            ? { contentSid: templateSid, variables: marketWhatsappTemplateVariables(copy) }
            : { body: marketWhatsappBody(copy) }
        );
        if (result.ok) {
          summary.sent += 1;
          const { error: updateError } = await supabase
            .from("market_whatsapp_subscriptions")
            .update({ sent_night: tonight, sent_count: sentCount, last_error: null, failed_at: null, updated_at: now.toISOString() })
            .eq("id", subscription.id);
          if (updateError) console.error("[market] whatsapp subscription update failed:", updateError);
          return;
        }
        summary.failed += 1;
        const { error: updateError } = await supabase
          .from("market_whatsapp_subscriptions")
          .update({
            last_error: `${result.status} ${result.code ?? ""} ${result.message}`.slice(0, 500),
            failed_at: now.toISOString(),
            ...(result.optedOut ? { opted_out_at: now.toISOString() } : {}),
            updated_at: now.toISOString(),
          })
          .eq("id", subscription.id);
        if (updateError) console.error("[market] whatsapp subscription update failed:", updateError);
      } catch (err) {
        summary.failed += 1;
        console.error("[market] whatsapp send failed:", err);
      }
    })
  );
  console.info(
    `[market] whatsapp alerts: ${alerts.length} event(s), ${subscriptions.length} number(s), sent ${summary.sent}, capped ${summary.skipped}, failed ${summary.failed}`
  );
  return summary;
}
