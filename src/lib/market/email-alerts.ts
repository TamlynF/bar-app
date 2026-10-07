import type { SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { EMAIL_FROM } from "@/lib/email";
import { siteUrl } from "@/lib/site-url";
import { tradingNightOf } from "./normal-units";
import { normaliseEmail } from "./verification-code";
import { ALERT_KINDS, alertLine, relevantTo, type MarketPushEvent } from "./push-alerts";
import { alertsLeftTonight } from "./alert-quota";
import {
  EMAIL_MAX_PER_NIGHT,
  marketEmailHtml,
  marketEmailSubject,
  marketEmailText,
  verificationEmailHtml,
  verificationEmailSubject,
  verificationEmailText,
} from "./email-copy";

type EmailSubscriptionRow = {
  id: number;
  email: string;
  manage_token: string;
  watched_instrument_ids: number[] | null;
  sent_night: string | null;
  sent_count: number;
};

/* Resend is already wired for the booking emails, so the switch here is a
   deliberate opt-in: MARKET_EMAIL_ALERTS=on (plus the Resend key) lights the
   email option up on /market; anything else keeps it "coming soon". */
export function emailAlertsEnabled(): boolean {
  const flag = (process.env.MARKET_EMAIL_ALERTS ?? "").trim().toLowerCase();
  return Boolean(process.env.RESEND_API_KEY) && ["1", "true", "on", "yes"].includes(flag);
}

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export function unsubscribeUrl(email: string, token: string): string {
  const params = new URLSearchParams({ e: email, t: token });
  return `${siteUrl()}/market/unsubscribe?${params.toString()}`;
}

export function oneClickUnsubscribeUrl(email: string, token: string): string {
  const params = new URLSearchParams({ e: email, t: token });
  return `${siteUrl()}/api/market/unsubscribe?${params.toString()}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* Shared by the unsubscribe page and the one-click POST. The token is the
   row's manage_token, so only someone holding the email can switch it off. */
export async function optOutEmailSubscription(
  supabase: SupabaseClient,
  rawEmail: string | null | undefined,
  token: string | null | undefined
): Promise<boolean> {
  const email = normaliseEmail(rawEmail ?? "");
  if (!email || !token || !UUID.test(token)) return false;
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("market_email_subscriptions")
    .update({ opted_out_at: now, updated_at: now })
    .eq("email", email)
    .eq("manage_token", token)
    .select("id");
  if (error) {
    console.error("[market] email unsubscribe failed:", error);
    return false;
  }
  return (data?.length ?? 0) > 0;
}

export async function sendVerificationEmail(email: string, code: string): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const { error } = await getResend().emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: verificationEmailSubject(code),
      html: verificationEmailHtml(code),
      text: verificationEmailText(code),
    });
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

/* Email every verified address that has something to hear about this tick,
   at most EMAIL_MAX_PER_NIGHT times a trading night. Each email carries a
   signed unsubscribe link and the List-Unsubscribe headers mail apps use. */
export async function sendMarketEmailAlerts(
  supabase: SupabaseClient,
  events: MarketPushEvent[]
): Promise<{ sent: number; skipped: number; failed: number }> {
  const summary = { sent: 0, skipped: 0, failed: 0 };
  const alerts = events.filter((event) => ALERT_KINDS.has(event.kind));
  if (alerts.length === 0 || !emailAlertsEnabled()) return summary;

  const { data, error } = await supabase
    .from("market_email_subscriptions")
    .select("id, email, manage_token, watched_instrument_ids, sent_night, sent_count")
    .not("verified_at", "is", null)
    .is("opted_out_at", null);
  if (error) {
    console.error("[market] email subscriptions read failed:", error);
    return summary;
  }
  const subscriptions = (data ?? []) as EmailSubscriptionRow[];
  if (subscriptions.length === 0) return summary;

  const now = new Date();
  const tonight = tradingNightOf(now);
  const marketUrl = `${siteUrl()}/market`;
  const resend = getResend();

  await Promise.all(
    subscriptions.map(async (subscription) => {
      const relevant = relevantTo(subscription, alerts);
      if (relevant.length === 0) return;
      if (alertsLeftTonight(subscription.sent_night, subscription.sent_count, tonight, EMAIL_MAX_PER_NIGHT) === 0) {
        summary.skipped += 1;
        return;
      }
      const lines = relevant.map(alertLine);
      const crash = relevant.some((event) => event.kind === "crash");
      const unsubscribe = unsubscribeUrl(subscription.email, subscription.manage_token);
      const copy = { lines, crash, marketUrl, unsubscribeUrl: unsubscribe };
      const sentCount = subscription.sent_night === tonight ? subscription.sent_count + 1 : 1;
      try {
        const { error: sendError } = await resend.emails.send({
          from: EMAIL_FROM,
          to: subscription.email,
          subject: marketEmailSubject(lines, crash),
          html: marketEmailHtml(copy),
          text: marketEmailText(copy),
          headers: {
            "List-Unsubscribe": `<${oneClickUnsubscribeUrl(subscription.email, subscription.manage_token)}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        });
        if (!sendError) {
          summary.sent += 1;
          const { error: updateError } = await supabase
            .from("market_email_subscriptions")
            .update({ sent_night: tonight, sent_count: sentCount, last_error: null, failed_at: null, updated_at: now.toISOString() })
            .eq("id", subscription.id);
          if (updateError) console.error("[market] email subscription update failed:", updateError);
          return;
        }
        summary.failed += 1;
        const { error: updateError } = await supabase
          .from("market_email_subscriptions")
          .update({ last_error: sendError.message.slice(0, 500), failed_at: now.toISOString(), updated_at: now.toISOString() })
          .eq("id", subscription.id);
        if (updateError) console.error("[market] email subscription update failed:", updateError);
      } catch (err) {
        summary.failed += 1;
        console.error("[market] email send failed:", err);
      }
    })
  );
  console.info(
    `[market] email alerts: ${alerts.length} event(s), ${subscriptions.length} address(es), sent ${summary.sent}, capped ${summary.skipped}, failed ${summary.failed}`
  );
  return summary;
}
