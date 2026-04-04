"use server";

import { createClient } from "@/lib/supabase/server";
import { squareClient } from "@/lib/square";
import { revalidatePath } from "next/cache";

export async function getBingoEventList(type: string, subType: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, date, title, event_types!inner(category: type, sub_type)")
    .ilike("event_types.type", type)
    .ilike("event_types.sub_type", subType);
  if (error) throw new Error("Failed to fetch bingo events");
  return data ?? [];
}

export async function getBingoBookings(selectedDate: string | null, selectedEventId?: string | null) {
  const supabase = await createClient();

  let query = supabase
    .from("bookings")
    .select(`
      id,
      event_id,
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
    .ilike("events.event_types.type", "games")
    .ilike("events.event_types.sub_type", "bingo")
    .order("date", { referencedTable: "events", ascending: false });

  if (selectedDate) {
    query = query.eq("events.date", selectedDate);
  }
  if (selectedEventId) {
    query = query.eq("event_id", selectedEventId);
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
  revalidatePath("/event-bookings/bingo-bookings");
  revalidatePath("/dashboard");
}

export async function updateBingoBookingDetails(
  id: string,
  updates: {
    group_name?: string;
    group_size?: number;
    special_requests?: string;
    status?: string;
    table_id?: string;
    event_id?: string;
  }
) {
  const supabase = await createClient();
  const { table_id, ...bookingUpdates } = updates;
  const { error } = await supabase
    .from("bookings")
    .update({ ...bookingUpdates, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error("Failed to update booking");

  if (Object.prototype.hasOwnProperty.call(updates, "table_id")) {
    await supabase.from("booking_table_mappings").delete().eq("booking_id", id);
    if (table_id && table_id !== "") {
      const { data: tableData } = await supabase
        .from("tables")
        .select("max_capacity")
        .eq("id", table_id)
        .single();
      const groupSize = updates.group_size || 0;
      const maxCap = tableData?.max_capacity || 0;
      const addSeatCount = groupSize > maxCap ? groupSize - maxCap : 0;
      await supabase.from("booking_table_mappings").insert({
        booking_id: id,
        table_id: parseInt(table_id),
        add_seat: addSeatCount,
      });
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/event-bookings/bingo-bookings");
}

export async function deleteBingoBooking(id: string) {
  const supabase = await createClient();
  await supabase.from("booking_table_mappings").delete().eq("booking_id", id);
  const { error } = await supabase.from("bookings").delete().eq("id", id);
  if (error) throw new Error("Failed to delete");
  revalidatePath("/dashboard");
  revalidatePath("/event-bookings/bingo-bookings");
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

  revalidatePath("/event-bookings/bingo-bookings");
  revalidatePath("/dashboard");
}
