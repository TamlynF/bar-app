"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { checkTeamName } from "./create-booking";

export async function updateBooking(
  bookingId: string | number, 
  updates: { 
    group_name?: string, 
    group_size?: number,
    special_requests?: string // Added special_requests
  }
) {
  try {
    const supabase = await createClient();

    // 1. Fetch current booking info to get the event context and existing status/size
    const { data: currentBooking, error: fetchError } = await supabase
      .from("bookings")
      .select(`
        id,
        event_id,
        status,
        group_size,
        events (date)
      `)
      .eq("id", bookingId)
      .single();

    if (fetchError || !currentBooking) {
      return { success: false, error: "Booking not found." };
    }

    // Resolving ts(2339): Supabase joins often return as an array in inferred types.
    // We type the joined event data specifically to handle both array and object formats safely.
    const eventData = currentBooking.events as { date: string } | { date: string }[] | null;
    const eventDate = Array.isArray(eventData)
      ? eventData[0]?.date
      : eventData?.date;
    const eventId = currentBooking.event_id;

    // 2. If the team name is being changed, verify it isn't already taken for this event
    if (updates.group_name && eventDate) {
      const { isAvailable } = await checkTeamName(
        updates.group_name, 
        eventDate, 
        bookingId
      );

      if (!isAvailable) {
        return { success: false, error: "This team name is already taken for this event." };
      }
    }

    // 3. Handle Table Re-allocation if group_size changes
    let finalStatus = currentBooking.status;
    const newSize = updates.group_size ?? currentBooking.group_size;
    const sizeChanged = updates.group_size !== undefined && updates.group_size !== currentBooking.group_size;

    // Only attempt re-allocation if the size actually changed or if the booking is currently waitlisted/pending
    if (sizeChanged || currentBooking.status !== 'confirmed') {
      // a. Find what tables are in use for THIS event by other confirmed bookings
      const { data: eventBookings } = await supabase
        .from("bookings")
        .select("id")
        .eq("event_id", eventId)
        .eq("status", "confirmed")
        .neq("id", bookingId);

      const otherConfirmedIds = eventBookings?.map(b => b.id) || [];
      
      let tablesInUse: number[] = [];
      if (otherConfirmedIds.length > 0) {
        const { data: takenMappings } = await supabase
          .from("booking_table_mappings")
          .select("table_id")
          .in("booking_id", otherConfirmedIds);
        tablesInUse = takenMappings?.map(m => m.table_id) || [];
      }

      // b. Find best available table that fits the new size
      const { data: suitableTables } = await supabase
        .from("tables")
        .select("id, max_capacity")
        .eq("available", true)
        .gte("max_capacity", newSize)
        .order("max_capacity", { ascending: true });

      const availableTable = suitableTables?.find(t => !tablesInUse.includes(t.id));

      if (availableTable) {
        await supabase.from("booking_table_mappings").delete().eq("booking_id", bookingId);
        await supabase
          .from("booking_table_mappings")
          .insert({
            booking_id: bookingId,
            table_id: availableTable.id
          });
        
        finalStatus = "confirmed";
      } else if (sizeChanged) {
        await supabase.from("booking_table_mappings").delete().eq("booking_id", bookingId);
        finalStatus = "waitlisted";
      }
    }

    // 4. Update the primary booking record
    const { error: updateError } = await supabase
      .from("bookings")
      .update({
        ...updates,
        status: finalStatus
      })
      .eq("id", bookingId);

    if (updateError) {
      console.error("Update booking error:", updateError);
      return { success: false, error: "Failed to update booking. Please try again." };
    }

    // Revalidate for both public and admin views
    revalidatePath(`/manage-booking/${bookingId}`);
    revalidatePath("/dashboard");
    revalidatePath("/event-bookings/quiz-bookings");
    
    return { success: true };
  } catch (err) {
    console.error("Action error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}