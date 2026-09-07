"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const subscriptionSchema = z.object({
  endpoint: z.url().max(2048).refine((value) => value.startsWith("https://"), "Push endpoints must be https"),
  p256dh: z.string().min(1).max(256),
  auth: z.string().min(1).max(128),
  watchedInstrumentIds: z.array(z.number().int().positive()).max(200),
  userAgent: z.string().max(512).optional(),
});

export type SaveMarketPushSubscriptionInput = z.infer<typeof subscriptionSchema>;

export type MarketPushActionResult = { ok: true } | { ok: false; error: string };

export async function saveMarketPushSubscription(input: unknown): Promise<MarketPushActionResult> {
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That subscription didn't look right." };

  const { endpoint, p256dh, auth, watchedInstrumentIds, userAgent } = parsed.data;
  const supabase = createAdminClient();
  const { error } = await supabase.from("market_push_subscriptions").upsert(
    {
      endpoint,
      p256dh,
      auth,
      watched_instrument_ids: watchedInstrumentIds,
      user_agent: userAgent ?? null,
      last_error: null,
      failed_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );
  if (error) {
    console.error("[market] push subscription save failed:", error);
    return { ok: false, error: "Couldn't save your alerts. Try again in a moment." };
  }
  return { ok: true };
}

export async function removeMarketPushSubscription(endpoint: string): Promise<MarketPushActionResult> {
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://")) {
    return { ok: false, error: "Unknown subscription." };
  }
  const supabase = createAdminClient();
  const { error } = await supabase.from("market_push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) {
    console.error("[market] push subscription delete failed:", error);
    return { ok: false, error: "Couldn't turn alerts off. Try again in a moment." };
  }
  return { ok: true };
}
