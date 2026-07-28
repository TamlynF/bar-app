import type { SupabaseClient } from "@supabase/supabase-js";
import {
  allocateOnCreate,
  commitMapping,
  seatingApplies,
  type FreeTable,
  type SeatingEvent,
} from "@/lib/table-allocation";
import { updateFullyBookedStatus } from "@/lib/update-fully-booked";
import { notifyAdminBookingCreated } from "@/lib/booking-notifications";

export type SettleResult =
  | { outcome: "settled"; status: string }
  | { outcome: "already_paid" }
  | { outcome: "not_found" };

export async function settlePaidBooking(
  supabase: SupabaseClient,
  args: {
    bookingId: string | number;
    paidAmount: number;
    squarePaymentId?: string | null;
  }
): Promise<SettleResult> {
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, event_id, group_size, status, payment_status")
    .eq("id", args.bookingId)
    .maybeSingle();

  if (!booking) return { outcome: "not_found" };
  if (booking.payment_status === "paid") return { outcome: "already_paid" };

  const eventId = (booking.event_id as number | null) ?? null;
  const groupSize = (booking.group_size as number) ?? 0;
  const currentStatus = (booking.status as string) ?? "";
  const isPending = currentStatus === "pending";

  let chosenTable: FreeTable | null = null;
  let nextStatus = isPending ? "confirmed" : currentStatus;

  if (isPending && eventId != null) {
    const { data: event } = await supabase
      .from("events")
      .select("id, seating_required, is_bookable")
      .eq("id", eventId)
      .maybeSingle();

    if (event && seatingApplies(event as SeatingEvent)) {
      const allocation = await allocateOnCreate(supabase, { eventId, groupSize });
      nextStatus = allocation.status;
      chosenTable = allocation.status === "confirmed" ? allocation.table : null;
    }
  }

  const { data: claimed } = await supabase
    .from("bookings")
    .update({
      payment_status: "paid",
      status: nextStatus,
      paid_amount: args.paidAmount,
      square_payment_id: args.squarePaymentId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", args.bookingId)
    .neq("payment_status", "paid")
    .select("id");

  if (!claimed || claimed.length === 0) return { outcome: "already_paid" };

  if (chosenTable && eventId != null) {
    const mapped = await commitMapping(supabase, {
      bookingId: args.bookingId,
      eventId,
      tableId: chosenTable.id,
      groupSize,
    });
    if (!mapped.ok) {
      nextStatus = "waitlisted";
      await supabase.from("bookings").update({ status: "waitlisted" }).eq("id", args.bookingId);
    }
  }

  if (eventId != null) await updateFullyBookedStatus(supabase, eventId);

  await notifyAdminBookingCreated(args.bookingId);

  return { outcome: "settled", status: nextStatus };
}
