import type { SupabaseClient } from "@supabase/supabase-js";
import { squareClient } from "@/lib/square";
import { settlePaidBooking } from "@/lib/settle-paid-booking";
import { releaseUnpaidBooking } from "@/lib/release-unpaid-booking";

export const STALE_UNPAID_MINUTES = 60;

export function staleCutoff(now: Date, minutes = STALE_UNPAID_MINUTES): string {
  return new Date(now.getTime() - minutes * 60_000).toISOString();
}

export interface StaleSweepResult {
  examined: number;
  settled: number;
  released: number;
}

async function findSquareTender(orderId: string) {
  try {
    const { order } = await squareClient.orders.get({ orderId });
    return order?.tenders?.[0] ?? null;
  } catch (err) {
    console.error(`[releaseStaleBookings] Square order lookup failed for ${orderId}:`, err);
    return undefined;
  }
}

export async function releaseStaleUnpaidBookings(
  supabase: SupabaseClient,
  opts: { now?: Date; minutes?: number } = {}
): Promise<StaleSweepResult> {
  const cutoff = staleCutoff(opts.now ?? new Date(), opts.minutes);

  const { data: stale, error } = await supabase
    .from("bookings")
    .select("id, event_id, total_amount, square_order_id, created_at")
    .eq("status", "pending")
    .eq("payment_status", "unpaid")
    .lt("created_at", cutoff);

  if (error) {
    console.error("[releaseStaleBookings] lookup failed:", error);
    return { examined: 0, settled: 0, released: 0 };
  }

  const rows = stale ?? [];
  let settled = 0;
  let released = 0;

  for (const row of rows) {
    const orderId = row.square_order_id as string | null;

    if (orderId) {
      const tender = await findSquareTender(orderId);
      if (tender === undefined) continue; // Square unreachable — leave it for the next run
      if (tender) {
        const paidAmount = tender.amountMoney?.amount
          ? Number(tender.amountMoney.amount) / 100
          : ((row.total_amount as number) ?? 0);
        const result = await settlePaidBooking(supabase, {
          bookingId: row.id as number,
          paidAmount,
          squarePaymentId: tender.id ?? null,
        });
        if (result.outcome === "settled") settled += 1;
        continue;
      }
    }

    const { released: didRelease } = await releaseUnpaidBooking(supabase, {
      bookingId: row.id as number,
      eventId: (row.event_id as number | null) ?? null,
    });
    if (didRelease) released += 1;
  }

  return { examined: rows.length, settled, released };
}
