"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { updateFullyBookedStatus } from "@/lib/update-fully-booked";
import {
  getFreeTablesForEvent,
  assignTableDirect,
  clearMappingOnStatusChange,
} from "@/lib/table-allocation";
import { ALL_SUBTYPES } from "@/lib/booking-grouping";

const GENERAL_PATH = "/event-bookings/general/[type]/[subtype]";

export async function getEventsForType(type: string, subType: string) {
  const supabase = await createClient();
  // The ALL_SUBTYPES sentinel (per_type grouping) lists every sub-type's events.
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
  return data ?? [];
}

/**
 * Tables available for a specific event that can seat the group — excludes tables
 * already taken by other (non-cancelled) bookings on that event, but keeps the
 * booking's current table. Mirrors the quiz-bookings helper.
 */
export async function getAvailableTablesForEventGeneral(
  eventId: string,
  groupSize: number,
  currentTableId?: string,
) {
  const supabase = await createClient();
  // Delegates to the shared module (single source of truth). The booking's own
  // current table is re-included via excludeTableId so it stays selectable.
  return getFreeTablesForEvent(supabase, Number(eventId), {
    groupSize,
    excludeTableId: currentTableId ? Number(currentTableId) : undefined,
  });
}

/**
 * Updates a booking's details and (re)assigns its table. Mirrors the quiz-bookings
 * `updateBookingDetails`, including add_seat calculation and updated_by tracking.
 */
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

  // Resolve which employee is making this change
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

  // Resolve the event (prefer the explicit event_id, else the booking's own).
  let eventId: number | null = updates.event_id ? Number(updates.event_id) : null;
  if (eventId == null) {
    const { data: bookingRow } = await supabase
      .from("bookings")
      .select("event_id")
      .eq("id", id)
      .single();
    eventId = (bookingRow?.event_id as number) ?? null;
  }

  // Table mapping — routed through the shared module (rules 3c / 3d).
  if (Object.prototype.hasOwnProperty.call(updates, "table_id")) {
    const leavingConfirmed =
      updates.status !== undefined && updates.status.toLowerCase() !== "confirmed";

    if (leavingConfirmed || !table_id) {
      await clearMappingOnStatusChange(supabase, id); // 3c / explicit clear
    } else if (eventId != null) {
      const result = await assignTableDirect(supabase, {
        bookingId: id,
        eventId,
        tableId: parseInt(table_id),
        groupSize: updates.group_size || 0,
      });
      if (!result.ok) {
        throw new Error(
          result.reason === "double_booked"
            ? "That table was just taken by another booking for this event."
            : "That table is not available."
        );
      }
    }
  }

  if (eventId != null) {
    await updateFullyBookedStatus(supabase, eventId);
  }

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

/** All bookable tables (capacity only) — feeds the seating "Table Status" stats. */
export async function getAllTables() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tables")
    .select("id, name, max_capacity")
    .eq("available", true);
  return data ?? [];
}

/**
 * Quiz progress for an event: how many questions are saved vs the configured
 * total. Mirrors the quiz-bookings page's getQuizStatusStats.
 */
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
