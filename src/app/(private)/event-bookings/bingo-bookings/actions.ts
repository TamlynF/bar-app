"use server";

import { createClient } from "@/lib/supabase/server";
import { squareClient } from "@/lib/square";
import { revalidatePath } from "next/cache";
import { updateFullyBookedStatus } from "@/lib/update-fully-booked";
import {
  clearMappingOnStatusChange,
  reconcileSeatedBookingTable,
  planConfirmSeating,
  commitMapping,
  seatingErrorMessage,
} from "@/lib/table-allocation";

export async function getBingoEventList() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, date, title, event_subtypes!inner(behavior)")
    .eq("event_subtypes.behavior", "bingo");
  if (error) throw new Error("Failed to fetch bingo events");
  return data ?? [];
}

export async function getBingoBookings(selectedDate: string | null, selectedEventId?: string | null, filterStatus?: string | null, filterPaymentStatus?: string | null, filterFromDate?: string | null, filterMinTotal?: string | null) {
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
      contacts!bookings_contact_id_fkey(full_name, email, country_code, phone_no),
      events!bookings_event_id_fkey!inner(
        event_date: date,
        event_title: title,
        event_payment_amount: payment_amount,
        event_types!inner(category: name),
        event_subtypes!inner(sub_type: name)
      ),
      booking_table_mappings(
        tables(tables_id: id, tables_name: name, tables_capacity: max_capacity)
      )
    `)
    .eq("events.event_subtypes.behavior", "bingo")
    .order("date", { referencedTable: "events", ascending: false });

  if (selectedDate) {
    query = query.eq("events.date", selectedDate);
  }
  if (selectedEventId) {
    query = query.eq("event_id", selectedEventId);
  }
  if (filterStatus) {
    const statuses = filterStatus.split(",").map((s) => s.trim()).filter(Boolean);
    if (statuses.length === 1) {
      query = query.eq("status", statuses[0]);
    } else if (statuses.length > 1) {
      query = query.in("status", statuses);
    }
  }
  if (filterPaymentStatus) {
    const paymentStatuses = filterPaymentStatus.split(",").map((s) => s.trim()).filter(Boolean);
    if (paymentStatuses.length === 1) {
      query = query.eq("payment_status", paymentStatuses[0]);
    } else if (paymentStatuses.length > 1) {
      query = query.in("payment_status", paymentStatuses);
    }
  }
  if (filterFromDate) {
    query = query.gte("events.date", filterFromDate);
  }
  if (filterMinTotal) {
    query = query.gt("total_amount", parseFloat(filterMinTotal));
  }

  const { data, error } = await query;
  if (error) {
    console.error("Failed to fetch bingo bookings", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      filters: {
        selectedDate,
        selectedEventId,
        filterStatus,
        filterPaymentStatus,
        filterFromDate,
        filterMinTotal,
      },
    });
    throw new Error("Failed to fetch bingo bookings");
  }
  return data ?? [];
}

export async function updateBingoBookingStatus(id: string, status: string) {
  const supabase = await createClient();
  const { data: bookingRow } = await supabase
    .from("bookings")
    .select("event_id, group_size")
    .eq("id", id)
    .single();
  const eventId = bookingRow?.event_id as number | null;
  const wantConfirmed = status.toLowerCase() === "confirmed";

  let tableToAssign = null;
  if (wantConfirmed && eventId != null) {
    const plan = await planConfirmSeating(supabase, {
      eventId,
      bookingId: id,
      groupSize: (bookingRow?.group_size as number) ?? 0,
    });
    if (!plan.ok) throw new Error(seatingErrorMessage("no_table"));
    tableToAssign = plan.tableToAssign;
  }

  const { error } = await supabase
    .from("bookings")
    .update({ status: status.toLowerCase(), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error("Failed to update status");

  if (wantConfirmed) {
    if (tableToAssign && eventId != null) {
      await commitMapping(supabase, {
        bookingId: id,
        eventId,
        tableId: tableToAssign.id,
        groupSize: (bookingRow?.group_size as number) ?? 0,
      });
    }
  } else {
    await clearMappingOnStatusChange(supabase, id);
  }
  if (eventId != null) await updateFullyBookedStatus(supabase, eventId);

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

  const { data: prev } = await supabase
    .from("bookings")
    .select("group_size, status, event_id")
    .eq("id", id)
    .single();
  const oldSize = (prev?.group_size as number) ?? 0;
  const eventId: number | null = updates.event_id
    ? Number(updates.event_id)
    : (prev?.event_id as number) ?? null;

  const { table_id, ...bookingUpdates } = updates;
  const { error } = await supabase
    .from("bookings")
    .update({ ...bookingUpdates, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error("Failed to update booking");

  const newSize = updates.group_size ?? oldSize;
  const finalStatus = (updates.status ?? (prev?.status as string) ?? "").toLowerCase();
  const result = await reconcileSeatedBookingTable(supabase, {
    bookingId: id,
    eventId,
    oldSize,
    newSize,
    finalStatus,
    tableFieldPresent: Object.prototype.hasOwnProperty.call(updates, "table_id"),
    tableId: table_id && table_id !== "" ? parseInt(table_id) : null,
  });
  if (!result.ok) {
    throw new Error(seatingErrorMessage(result.reason));
  }

  if (eventId != null) await updateFullyBookedStatus(supabase, eventId);

  revalidatePath("/dashboard");
  revalidatePath("/event-bookings/bingo-bookings");
}

export async function deleteBingoBooking(id: string) {
  const supabase = await createClient();
  const { data: booking } = await supabase.from("bookings").select("event_id").eq("id", id).single();
  await supabase.from("booking_table_mappings").delete().eq("booking_id", id);
  const { error } = await supabase.from("bookings").delete().eq("id", id);
  if (error) throw new Error("Failed to delete");
  if (booking?.event_id) await updateFullyBookedStatus(supabase, booking.event_id);
  revalidatePath("/dashboard");
  revalidatePath("/event-bookings/bingo-bookings");
}

export async function refundBingoBooking(id: string) {
  const supabase = await createClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("square_order_id, paid_amount, square_payment_id, event_id")
    .eq("id", id)
    .maybeSingle();

  if (!booking) throw new Error("Booking not found");

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

  if (booking?.event_id) await updateFullyBookedStatus(supabase, booking.event_id);
  revalidatePath("/event-bookings/bingo-bookings");
  revalidatePath("/dashboard");
}
