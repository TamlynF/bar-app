"use server"

import { createClient } from "@/lib/supabase/server"

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
