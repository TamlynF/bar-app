"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { updateFullyBookedStatus } from "@/lib/update-fully-booked";
import { ALL_SUBTYPES } from "@/lib/booking-grouping";

const GENERAL_PATH = "/event-bookings/general/[type]/[subtype]";

export async function getEventsForType(type: string, subType: string) {
  const supabase = await createClient();
  // The ALL_SUBTYPES sentinel (per_type grouping) lists every sub-type's events.
  const allSubtypes = subType === ALL_SUBTYPES;
  let query = supabase
    .from("events")
    .select("id, date, title, event_types!inner(name), event_subtypes!inner(name)")
    .ilike("event_types.name", type);
  if (!allSubtypes) query = query.ilike("event_subtypes.name", subType);
  const { data } = await query.order("date", { ascending: false });
  return (data ?? []).map(e => ({
    id: String(e.id),
    date: String(e.date),
    title: (e as { title?: string | null }).title ?? null,
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
  try {
    const supabase = await createClient();

    const { data: eventBookings } = await supabase
      .from("bookings")
      .select("id")
      .eq("event_id", eventId)
      .not("status", "eq", "cancelled");

    const bookingIds = eventBookings?.map(b => b.id) || [];

    const { data: takenMappings } = await supabase
      .from("booking_table_mappings")
      .select("table_id")
      .in("booking_id", bookingIds);

    const takenTableIds = takenMappings?.map(m => m.table_id) || [];

    let query = supabase
      .from("tables")
      .select("id, name, max_capacity")
      .eq("available", true);

    const filteredTakenIds = currentTableId
      ? takenTableIds.filter(id => String(id) !== String(currentTableId))
      : takenTableIds;

    if (filteredTakenIds.length > 0) {
      query = query.not("id", "in", `(${filteredTakenIds.join(",")})`);
    }

    const { data: tables, error } = await query.order("max_capacity", { ascending: true });
    if (error) throw error;

    return tables?.filter(t => t.max_capacity >= groupSize) || [];
  } catch (error) {
    console.error("Error fetching event-specific tables:", error);
    return [];
  }
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

  // Update table mapping when table_id is explicitly provided (empty string clears it)
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

      const { error: mappingError } = await supabase
        .from("booking_table_mappings")
        .insert({ booking_id: id, table_id: parseInt(table_id), add_seat: addSeatCount });

      if (mappingError) {
        console.error("Error updating table mapping:", mappingError);
        throw new Error("Failed to update table assignment");
      }
    }
  }

  if (updates.event_id) {
    await updateFullyBookedStatus(supabase, Number(updates.event_id));
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
      host:employees!events_host_employee_id_fkey(full_name),
      event_types!inner(name),
      event_subtypes!inner(name, color)
    `)
    .eq("id", eventId)
    .maybeSingle();
  return data;
}
