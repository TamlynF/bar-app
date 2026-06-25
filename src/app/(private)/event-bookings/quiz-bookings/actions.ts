"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { updateFullyBookedStatus } from "@/lib/update-fully-booked"
import {
  getFreeTablesForEvent,
  assignTableDirect,
  clearMappingOnStatusChange,
} from "@/lib/table-allocation"

export async function getBookings(type: string, subType: string, selectedDate: string | null, selectedEventId?: string | null) {
  try {
    const supabase = await createClient()

    let query = supabase
      .from("bookings")
      .select(`
          id,
          event_id,
          group_name,
          team_id,
          contact_id,
          group_size,
          paid_amount,
          total_amount,
          status,
          special_requests,
          booking_created_at: created_at,
          contacts!bookings_contact_id_fkey(
            full_name,
            email,
            country_code,
            phone_no
          ),
          events!bookings_event_id_fkey!inner(
            event_date: date,
            event_start_time: start_time,
            event_end_time: end_time,
            event_title: title,
            event_description: tagline,
            event_payment_amount: payment_amount,
            event_types!inner(
              category: name
            ),
            event_subtypes!inner(
              sub_type: name
            )
          ),
          booking_table_mappings(
            tables(
              tables_id: id,  
              tables_name: name,
              tables_capacity: max_capacity,
              tables_description: description,
              tables_available: available              
            )
          ),
          booking_scores(
            score,
            is_winner
          ),
          updated_at,
          updated_by,
          updated_by_employee:employees!updated_by(full_name, role),
          updated_by_contact_id,
          updated_by_contact:contacts!updated_by_contact_id(full_name)
        `)
      .ilike("events.event_types.name", type)
      .ilike("events.event_subtypes.name", subType)
      .order('date', { referencedTable: 'events', ascending: false })
      .order('group_name', { ascending: true });

    if (selectedDate) {
      query = query.eq("events.date", selectedDate);
    }
    if (selectedEventId) {
      query = query.eq("event_id", selectedEventId);
    }

    const { data: bookings, error } = await query;
    //console.log("Fetched bookings:", { bookings, error })

    if (error) {
      console.error("Error fetching bookings:", error)
      throw new Error("Failed to fetch bookings")
    }

    return bookings
  } catch (error) {
    console.error("Bookings data source unavailable:", error)
    throw new Error("An unexpected error occurred.")
  }
}

/**
 * Fetches tables that are available for a specific event and can accommodate the group size.
 * Excludes tables already mapped to other bookings for the same event.
 */
export async function getAvailableTablesForEvent(eventId: string, groupSize: number, currentTableId?: string) {
  const supabase = await createClient();
  // Delegates to the shared module (single source of truth). The booking's own
  // current table is re-included via excludeTableId so it stays selectable.
  return getFreeTablesForEvent(supabase, Number(eventId), {
    groupSize,
    excludeTableId: currentTableId ? Number(currentTableId) : undefined,
  });
}

export async function getAvailableTables() {
  try {
    const supabase = await createClient();

    const { data: tables, error } = await supabase
      .from("tables")
      .select("id, name, max_capacity") // Updated to include ID and Name
      .eq("available", true);
    
    if (error) {
      console.error("Error fetching available tables:", error)
      throw new Error("Failed to fetch available tables")
    }
    
    return tables;
  } catch (error) {
    console.error("Error fetching available tables:", error);
    throw new Error("Failed to fetch available tables");
  }
}

export async function getEventDetails(date: string, type: string, subType: string, eventId?: string | null) {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("events")
      .select(`
        id,
        start_time,
        end_time,
        title,
        tagline,
        payment_amount,
        host:employees!events_host_employee_id_fkey(full_name),
        event_types!inner(category: name),
        event_subtypes!inner(sub_type: name)
      `);
    if (eventId) {
      query = query.eq("id", eventId);
    } else {
      query = query
        .eq("date", date)
        .ilike("event_types.name", type)
        .ilike("event_subtypes.name", subType);
    }
    const { data, error } = await query.maybeSingle();
    if (error) return null;
    return data;
  } catch { return null; }
}

export async function getQuizStatusStats(eventId: number) {
  try {
    const supabase = await createClient();
    const [{ count: questionCount }, { data: categories }] = await Promise.all([
      supabase
        .from("past_quiz_questions")
        .select("*", { count: "exact", head: true })
        .eq("events_id", eventId),
      supabase.from("quiz_category_configs").select("question_count"),
    ]);
    const categoryTotal = (categories ?? []).reduce(
      (sum, r) => sum + (r.question_count ?? 0), 0
    );
    return { questionCount: questionCount ?? 0, categoryTotal };
  } catch { return { questionCount: 0, categoryTotal: 0 }; }
}

export async function getQuizEvents(type: string, subType: string) {
  try {
    const supabase = await createClient();
    const { data: events, error } = await supabase
      .from("events")
      .select("id, date, title, event_types!inner(category: name), event_subtypes!inner(sub_type: name)")
      .ilike("event_types.name", type)
      .ilike("event_subtypes.name", subType)


    
    if (error) {
      console.error("Error fetching quiz events:", error)
      throw new Error("Failed to fetch quiz events")
    }
    
    return events;
  } catch (error) {
    console.error("Error fetching quiz events:", error);
    throw new Error("Failed to fetch quiz events");
  }
}

/**
 * Updates comprehensive booking details including table assignment.
 * Calculates 'add_seat' count if the group size exceeds table capacity.
 */
export async function updateBookingDetails(
  id: string, 
  updates: { 
    group_name?: string; 
    group_size?: number; 
    special_requests?: string;
    status?: string;
    table_id?: string;
  }
) {
  const supabase = await createClient()

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

  // 1. Update primary booking record
  const { table_id, ...bookingUpdates } = updates;
  const { error: bookingError } = await supabase
    .from("bookings")
    .update({
      ...bookingUpdates,
      updated_at: new Date().toISOString(),
      updated_by: updatedById,
      updated_by_contact_id: null,
    })
    .eq("id", id)

  if (bookingError) {
    console.error("Error updating booking details:", bookingError)
    throw new Error("Failed to update booking")
  }

  // 2. Resolve the event for downstream allocation + fully-booked recompute.
  const { data: bookingRow } = await supabase
    .from("bookings")
    .select("event_id")
    .eq("id", id)
    .single();
  const eventId = bookingRow?.event_id as number | null;

  // 3. Table mapping — routed through the shared module.
  // table_id is explicitly provided (empty string clears it). A status moving
  // away from `confirmed` always frees the table (rule 3c).
  if (Object.prototype.hasOwnProperty.call(updates, "table_id")) {
    const leavingConfirmed =
      updates.status !== undefined && updates.status.toLowerCase() !== "confirmed";

    if (leavingConfirmed || !table_id) {
      await clearMappingOnStatusChange(supabase, id); // 3c / explicit clear
    } else if (eventId != null) {
      // 3d — validate + write the admin's explicit table pick.
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

  // 4. Keep is_fully_booked in sync after any allocation change.
  if (eventId != null) await updateFullyBookedStatus(supabase, eventId);

  revalidatePath("/dashboard")
  revalidatePath("/event-bookings/quiz-bookings")
}

export async function updateBookingStatus(id: string, status: string) {
  const supabase = await createClient()

  let updatedById: number | null = null;
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.email) {
    const { data: emp } = await supabase.from("employees").select("id").eq("email", user.email).single();
    if (emp) updatedById = emp.id;
  }

  const { data: bookingRow } = await supabase
    .from("bookings")
    .select("event_id")
    .eq("id", id)
    .single();
  const eventId = bookingRow?.event_id as number | null;

  const { error } = await supabase
    .from("bookings")
    .update({
      status: status.toLowerCase(),
      updated_by: updatedById,
      updated_by_contact_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)

  if (error) {
    console.error("Error updating booking status:", error)
    throw new Error("Failed to update booking status")
  }

  // Rule 3c: moving away from `confirmed` frees the booking's table.
  if (status.toLowerCase() !== "confirmed") {
    await clearMappingOnStatusChange(supabase, id);
  }
  if (eventId != null) await updateFullyBookedStatus(supabase, eventId);

  revalidatePath("/dashboard")
  revalidatePath("/event-bookings/quiz-bookings")
}

export async function deleteBooking(id: string) {
  const supabase = await createClient()

  // Get event_id before deleting
  const { data: booking } = await supabase
    .from("bookings")
    .select("event_id")
    .eq("id", id)
    .single()

  // Cascade delete mappings first (if not handled by DB constraints)
  await supabase.from("booking_table_mappings").delete().eq("booking_id", id);

  const { error } = await supabase
    .from("bookings")
    .delete()
    .eq("id", id)

  if (error) throw new Error("Failed to delete")

  // Update fully booked status after freeing the table
  if (booking?.event_id) {
    await updateFullyBookedStatus(supabase, booking.event_id)
  }

  revalidatePath("/dashboard")
  revalidatePath("/event-bookings/quiz-bookings")
}