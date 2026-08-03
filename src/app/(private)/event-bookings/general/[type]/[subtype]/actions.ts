"use server";

import { createClient } from "@/lib/supabase/server";
import { squareClient } from "@/lib/square";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { updateFullyBookedStatus } from "@/lib/update-fully-booked";
import { loadBookingSnapshot, notifyBookingChanged } from "@/lib/booking-notifications";
import {
  clearMappingOnStatusChange,
  getFreeTablesForEvent,
  reconcileSeatedBookingTable,
  seatingErrorMessage,
} from "@/lib/table-allocation";
import { ALL_SUBTYPES } from "@/lib/booking-grouping";
import { withStringBookingIds, type RawBookingRowIds } from "@/lib/booking-row-ids";

const GENERAL_PATH = "/event-bookings/general/[type]/[subtype]";

export async function getEventsForType(type: string, subType: string) {
  const supabase = await createClient();
  const allSubtypes = subType === ALL_SUBTYPES;
  let query = supabase
    .from("events")
    .select("id, date, title, start_time, event_types!inner(name), event_subtypes!inner(name)")
    .ilike("event_types.name", type);
  if (!allSubtypes) query = query.ilike("event_subtypes.name", subType);
  const { data } = await query.order("date", { ascending: false });
  return (data ?? []).map(e => ({
    id: String(e.id),
    date: String(e.date),
    title: (e as { title?: string | null }).title ?? null,
    start_time: (e as { start_time?: string | null }).start_time ?? null,
  }));
}

export async function getNextActiveEventIdForType(
  type: string,
  subType: string,
): Promise<string | null> {
  const supabase = await createClient();
  const allSubtypes = subType === ALL_SUBTYPES;
  const today = new Date().toISOString().split("T")[0];
  let query = supabase
    .from("events")
    .select("id, date, start_time, event_types!inner(name), event_subtypes!inner(name)")
    .ilike("event_types.name", type)
    .eq("is_active", true)
    .gte("date", today)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(1);
  if (!allSubtypes) query = query.ilike("event_subtypes.name", subType);
  const { data } = await query;
  return data && data.length > 0 ? String(data[0].id) : null;
}

export async function getBookingsForType(
  type: string,
  subType: string,
  selectedEventId: string | null,
) {
  const supabase = await createClient();
  const allSubtypes = subType === ALL_SUBTYPES;
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
      booking_created_at: created_at,
      contacts!bookings_contact_id_fkey(full_name, email, country_code, phone_no),
      events!bookings_event_id_fkey!inner(
        event_date: date,
        event_start_time: start_time,
        event_end_time: end_time,
        event_title: title,
        event_payment_amount: payment_amount,
        seating_required,
        event_types!inner(category: name),
        event_subtypes!inner(sub_type: name)
      ),
      booking_table_mappings(
        tables(tables_id: id, tables_name: name, tables_capacity: max_capacity)
      )
    `)
    .ilike("events.event_types.name", type)
    .order("date", { referencedTable: "events", ascending: false })
    .order("group_name", { ascending: true });

  if (!allSubtypes) query = query.ilike("events.event_subtypes.name", subType);
  if (selectedEventId) query = query.eq("event_id", selectedEventId);

  const { data, error } = await query;
  if (error) {
    console.error("getBookingsForType error:", error);
    return [];
  }

  const rows = (data ?? []) as unknown as (RawBookingRowIds & { events?: unknown })[];
  const eventOf = (b: (typeof rows)[number]) => {
    const ev = b.events;
    return (Array.isArray(ev) ? ev[0] : ev) as { event_date?: string; event_start_time?: string | null } | undefined;
  };
  rows.sort((a, b) => {
    const ea = eventOf(a);
    const eb = eventOf(b);
    const dateCmp = (eb?.event_date ?? "").localeCompare(ea?.event_date ?? "");
    if (dateCmp !== 0) return dateCmp;
    return (eb?.event_start_time ?? "").localeCompare(ea?.event_start_time ?? "");
  });
  return rows.map(withStringBookingIds);
}

export async function getAvailableTablesForEventGeneral(
  eventId: string,
  groupSize: number,
  currentTableId?: string,
) {
  const supabase = await createClient();
  return getFreeTablesForEvent(supabase, Number(eventId), {
    groupSize,
    excludeTableId: currentTableId ? Number(currentTableId) : undefined,
  });
}

export async function updateGeneralBookingDetails(
  id: string,
  updates: {
    group_name?: string;
    group_size?: number;
    special_requests?: string;
    status?: string;
    table_id?: string;
    event_id?: string;
  },
) {
  const supabase = await createClient();

  let updatedById: number | null = null;
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.email) {
    const { data: emp } = await supabase
      .from("employees")
      .select("id")
      .eq("email", user.email)
      .single();
    if (emp) updatedById = emp.id;
  }

  const { data: prev } = await supabase
    .from("bookings")
    .select("group_size, status, event_id")
    .eq("id", id)
    .single();
  const oldSize = (prev?.group_size as number) ?? 0;
  const eventId: number | null = updates.event_id
    ? Number(updates.event_id)
    : (prev?.event_id as number) ?? null;

  const before = await loadBookingSnapshot(id);

  const { table_id, ...bookingUpdates } = updates;
  const { error: bookingError } = await supabase
    .from("bookings")
    .update({
      ...bookingUpdates,
      updated_at: new Date().toISOString(),
      updated_by: updatedById,
      updated_by_contact_id: null,
    })
    .eq("id", id);

  if (bookingError) {
    console.error("Error updating booking details:", bookingError);
    throw new Error("Failed to update booking");
  }

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

  if (eventId != null) {
    await updateFullyBookedStatus(supabase, eventId);
  }

  if (before) await notifyBookingChanged(id, before.snapshot, { changedByAdmin: true });

  revalidatePath("/dashboard");
  revalidatePath(GENERAL_PATH, "page");
}

export async function deleteGeneralBooking(id: string) {
  const supabase = await createClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("event_id")
    .eq("id", id)
    .single();

  await supabase.from("booking_table_mappings").delete().eq("booking_id", id);

  const { error } = await supabase.from("bookings").delete().eq("id", id);
  if (error) throw new Error("Failed to delete");

  if (booking?.event_id) {
    await updateFullyBookedStatus(supabase, booking.event_id);
  }

  revalidatePath("/dashboard");
  revalidatePath(GENERAL_PATH, "page");
}

export async function refundGeneralBooking(id: string) {
  const supabase = await createClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("paid_amount, square_payment_id, event_id")
    .eq("id", id)
    .maybeSingle();

  if (!booking) throw new Error("Booking not found");

  let updatedById: number | null = null;
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.email) {
    const { data: emp } = await supabase
      .from("employees")
      .select("id")
      .eq("email", user.email)
      .maybeSingle();
    if (emp) updatedById = emp.id;
  }

  const before = await loadBookingSnapshot(id);

  if (booking.square_payment_id) {
    try {
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

  const { error } = await supabase
    .from("bookings")
    .update({
      payment_status: "refunded",
      status: "cancelled",
      updated_at: new Date().toISOString(),
      updated_by: updatedById,
      updated_by_contact_id: null,
    })
    .eq("id", id);
  if (error) {
    console.error("Error recording refund:", error);
    throw new Error("Refund succeeded in Square but the booking could not be updated");
  }

  await clearMappingOnStatusChange(supabase, id);

  if (booking.event_id) await updateFullyBookedStatus(supabase, booking.event_id);

  if (before) await notifyBookingChanged(id, before.snapshot, { changedByAdmin: true });

  revalidatePath("/dashboard");
  revalidatePath(GENERAL_PATH, "page");
}

export async function getEventDetailsForType(eventId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select(`
      id,
      date,
      start_time,
      end_time,
      title,
      tagline,
      payment_amount,
      seating_required,
      is_active,
      host:employees!events_host_employee_id_fkey(full_name),
      event_types!inner(name),
      event_subtypes!inner(name, color, behavior)
    `)
    .eq("id", eventId)
    .maybeSingle();
  return data;
}

export async function getTypeRequestKind(type: string): Promise<"music_act" | "private" | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("event_types")
    .select("booking_grouping, event_subtypes(behavior)")
    .ilike("name", type)
    .maybeSingle();
  if (!data || data.booking_grouping !== "per_type") return null;
  const behaviors = ((data.event_subtypes ?? []) as { behavior: string | null }[]).map((s) => s.behavior);
  if (behaviors.includes("music_act")) return "music_act";
  if (behaviors.includes("private")) return "private";
  return null;
}

export async function getBandRequestsForType() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("band_booking_requests")
    .select(
      "*, updated_by_employee:employees!updated_by(full_name), linked_event:events!band_booking_requests_event_id_fkey(is_active, date, start_time, end_time)"
    )
    .order("created_at", { ascending: false });
  if (error) console.error("getBandRequestsForType error:", error);
  return data ?? [];
}

export async function getPrivateHireRequestsForType() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("private_hire_requests")
    .select("*, event_subtypes:event_subtypes_id ( id, name, default_event_title, event_types_id ), updated_by_employee:employees!private_hire_requests_updated_by_fkey ( full_name )")
    .order("created_at", { ascending: false });
  if (error) console.error("getPrivateHireRequestsForType error:", error);
  return data ?? [];
}

export async function getAllTables() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tables")
    .select("id, name, max_capacity")
    .eq("available", true);
  return data ?? [];
}

export async function getQuizStatsForEvent(eventId: number) {
  const supabase = await createClient();
  try {
    const [{ count: questionCount }, { data: categories }] = await Promise.all([
      supabase.from("past_quiz_questions").select("*", { count: "exact", head: true }).eq("events_id", eventId),
      supabase.from("quiz_category_configs").select("question_count"),
    ]);
    const categoryTotal = (categories ?? []).reduce((sum, r) => sum + (r.question_count ?? 0), 0);
    return { questionCount: questionCount ?? 0, categoryTotal };
  } catch {
    return { questionCount: 0, categoryTotal: 0 };
  }
}
