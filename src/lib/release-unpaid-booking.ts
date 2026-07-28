import type { SupabaseClient } from "@supabase/supabase-js";
import { clearMappingOnStatusChange } from "@/lib/table-allocation";
import { updateFullyBookedStatus } from "@/lib/update-fully-booked";

export async function releaseUnpaidBooking(
  supabase: SupabaseClient,
  args: { bookingId: string | number; eventId: number | null }
): Promise<{ released: boolean }> {
  const { data: released } = await supabase
    .from("bookings")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", args.bookingId)
    .eq("payment_status", "unpaid")
    .select("id");

  if (!released || released.length === 0) return { released: false };

  await clearMappingOnStatusChange(supabase, args.bookingId);
  if (args.eventId != null) await updateFullyBookedStatus(supabase, args.eventId);

  return { released: true };
}
