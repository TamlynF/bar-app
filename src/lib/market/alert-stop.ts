import type { SupabaseClient } from "@supabase/supabase-js";
import { siteUrl } from "@/lib/site-url";

export type PhoneChannel = "sms" | "whatsapp";

export const PHONE_CHANNEL_TABLE: Record<PhoneChannel, string> = {
  sms: "market_sms_subscriptions",
  whatsapp: "market_whatsapp_subscriptions",
};

/* The "Stop" link in every text or WhatsApp message carries the row's
   stop_code; `c=w` picks the WhatsApp table, anything else means SMS. */
export function stopAlertsUrl(channel: PhoneChannel, stopCode: string): string {
  const params = new URLSearchParams({ t: stopCode });
  if (channel === "whatsapp") params.set("c", "w");
  return `${siteUrl()}/market/stop?${params.toString()}`;
}

export function channelFromStopParam(c: string | null | undefined): PhoneChannel {
  return c === "w" ? "whatsapp" : "sms";
}

export async function stopAlertsByCode(
  supabase: SupabaseClient,
  channel: PhoneChannel,
  code: string | null | undefined
): Promise<boolean> {
  if (!code || !/^[0-9a-f]{12}$/i.test(code)) return false;
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from(PHONE_CHANNEL_TABLE[channel])
    .update({ opted_out_at: now, updated_at: now })
    .eq("stop_code", code.toLowerCase())
    .select("id");
  if (error) {
    console.error(`[market] ${channel} stop link failed:`, error);
    return false;
  }
  return (data?.length ?? 0) > 0;
}
