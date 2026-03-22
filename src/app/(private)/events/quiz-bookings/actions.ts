"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function getBookings(type: string, subType: string, selectedDate: string | null) {
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
          contacts(
            full_name,
            email,
            country_code,
            phone_no
          ),
          events!inner(
            event_date: date,
            event_start_time: start_time,
            event_end_time: end_time,
            event_title: title,
            event_description: description,
            event_payment_amount: payment_amount,
            event_types!inner(
              category: type,
              sub_type
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
          )
        `)
      .ilike("events.event_types.type", type)
      .ilike("events.event_types.sub_type", subType)
      .order('date', { referencedTable: 'events', ascending: false })
      .order('group_name', { ascending: true });

    if (selectedDate) {
      query = query.eq("events.date", selectedDate);
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
  console.log("Fetching available tables for event:", { eventId, groupSize, currentTableId })

  try {
    const supabase = await createClient();

    // 1. Get all bookings for this event (excluding cancelled) to see what tables are taken
    const { data: eventBookings } = await supabase
      .from("bookings")
      .select("id")
      .eq("event_id", eventId)
      .not("status", "eq", "cancelled");

    console.log("Event bookings for table availability check:", { eventBookings })
    const bookingIds = eventBookings?.map(b => b.id) || [];
    console.log("Booking IDs for event:", { bookingIds }) 

    // 2. Find which tables are already assigned
    const { data: takenMappings } = await supabase
      .from("booking_table_mappings")
      .select("table_id")
      .in("booking_id", bookingIds);

    const takenTableIds = takenMappings?.map(m => m.table_id) || [];

    // 3. Get all available tables. 
    // We allow tables that might require 'add_seat' (e.g. table for 4 for a group of 5)
    // but typically we want to prioritize tables that fit.
    let query = supabase
      .from("tables")
      .select("id, name, max_capacity")
      .eq("available", true);

    // 4. Filter out taken tables, but keep the current one if provided
    const filteredTakenIds = currentTableId 
      ? takenTableIds.filter(id => String(id) !== String(currentTableId))
      : takenTableIds;

    if (filteredTakenIds.length > 0) {
      query = query.not("id", "in", `(${filteredTakenIds.join(',')})`);
    }

    const { data: tables, error } = await query.order('max_capacity', { ascending: true });
    
    if (error) throw error;

    // Filter in-memory to ensure capacity is at least groupSize OR within a reasonable squeeze limit (e.g. 1-2 people)
    // For now, we strict match capacity >= groupSize to ensure the UI doesn't over-book.
    return tables?.filter(t => t.max_capacity >= groupSize) || [];
  } catch (error) {
    console.error("Error fetching event-specific tables:", error);
    return [];
  }
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

export async function getQuizEvents(type: string, subType: string) {
  try {
    const supabase = await createClient();
    const { data: events, error } = await supabase
      .from("events")
      .select("id, date, title, event_types!inner(category: type, sub_type)")
      .ilike("event_types.type", type)
      .ilike("event_types.sub_type", subType)


    
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

  // 1. Update primary booking record
  const { table_id, ...bookingUpdates } = updates;
  const { error: bookingError } = await supabase
    .from("bookings")
    .update(bookingUpdates)
    .eq("id", id)

  if (bookingError) {
    console.error("Error updating booking details:", bookingError)
    throw new Error("Failed to update booking")
  }

  // 2. Update table mapping
  // If table_id is explicitly provided (even if empty string), we update the mapping
  if (updates.hasOwnProperty('table_id')) {
    // Delete existing mapping first to handle re-assignment or removal cleanly
    await supabase.from("booking_table_mappings").delete().eq("booking_id", id);
    
    // If a non-empty table_id is provided, create the new mapping
    if (table_id && table_id !== "") {
      // Fetch table capacity to calculate add_seat if necessary
      const { data: tableData } = await supabase
        .from("tables")
        .select("max_capacity")
        .eq("id", table_id)
        .single();

      const groupSize = updates.group_size || 0;
      const maxCap = tableData?.max_capacity || 0;
      
      // Calculate how many extra seats are needed beyond standard capacity
      const addSeatCount = groupSize > maxCap ? groupSize - maxCap : 0;

      const { error: mappingError } = await supabase
        .from("booking_table_mappings")
        .insert({
          booking_id: id,
          table_id: parseInt(table_id),
          add_seat: addSeatCount
        });

      if (mappingError) {
        console.error("Error updating table mapping:", mappingError);
        throw new Error("Failed to update table assignment");
      }
    }
  }

  revalidatePath("/dashboard")
  revalidatePath("/events/quiz-bookings")
}

export async function updateBookingStatus(id: string, status: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("bookings")
    .update({ status: status.toLowerCase() })
    .eq("id", id)

  if (error) {
    console.error("Error updating booking status:", error)
    throw new Error("Failed to update booking status")
  }

  revalidatePath("/dashboard")
  revalidatePath("/events/quiz-bookings")
}

export async function deleteBooking(id: string) {
  const supabase = await createClient()
  
  // Cascade delete mappings first (if not handled by DB constraints)
  await supabase.from("booking_table_mappings").delete().eq("booking_id", id);
  
  const { error } = await supabase
    .from("bookings")
    .delete()
    .eq("id", id)

  if (error) throw new Error("Failed to delete")
  revalidatePath("/dashboard")
  revalidatePath("/events/quiz-bookings")
}