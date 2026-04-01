"use server";

import { createClient } from "@/lib/supabase/server";
import { squareClient } from "@/lib/square";
import { revalidatePath } from "next/cache";

export async function getBingoBookings(selectedDate: string | null) {
  const supabase = await createClient();

  let query = supabase
    .from("bookings")
    .select(`
      id,
      group_name,
      group_size,
      status,
      payment_status,
      paid_amount,
      total_amount,
      special_requests,
      square_order_id,
      booking_created_at: created_at,
      contacts(full_name, email, country_code, phone_no),
      events!inner(
        event_date: date,
        event_title: title,
        event_payment_amount: payment_amount,
        event_types!inner(category: type, sub_type)
      ),
      booking_table_mappings(
        tables(tables_id: id, tables_name: name, tables_capacity: max_capacity)
      )
    `)
    .ilike("events.event_types.type", "game")
    .ilike("events.event_types.sub_type", "bingo")
    .order("date", { referencedTable: "events", ascending: false });

  if (selectedDate) {
    query = query.eq("events.date", selectedDate);
  }

  const { data, error } = await query;
  if (error) throw new Error("Failed to fetch bingo bookings");
  return data ?? [];
}

export async function updateBingoBookingStatus(id: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("bookings")
    .update({ status: status.toLowerCase(), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error("Failed to update status");
  revalidatePath("/events/bingo-bookings");
  revalidatePath("/dashboard");
}

export async function refundBingoBooking(id: string) {
  const supabase = await createClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("square_order_id, paid_amount, square_payment_id")
    .eq("id", id)
    .maybeSingle();

  if (!booking) throw new Error("Booking not found");

  // Attempt Square refund if we have a payment ID
  if (booking.square_payment_id) {
    try {
      const { randomUUID } = await import("crypto");
      await squareClient.refunds.refundPayment({
        idempotencyKey: randomUUID(),
        paymentId: booking.square_payment_id,
        amountMoney: {
          amount: BigInt(Math.round((booking.paid_amount ?? 0) * 100)),
          currency: "GBP",
        },
        reason: "Admin refund via Don Fenticas dashboard",
      });
    } catch (err) {
      console.error("Square refund error:", err);
      throw new Error("Square refund failed. Please process manually in Square dashboard.");
    }
  }

  await supabase
    .from("bookings")
    .update({
      payment_status: "refunded",
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  revalidatePath("/events/bingo-bookings");
  revalidatePath("/dashboard");
}
