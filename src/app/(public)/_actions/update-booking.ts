"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { checkTeamName } from "./create-booking";

export async function updateBooking(bookingId: string | number, updates: { group_name?: string, group_size?: number }) {
  try {
    const supabase = await createClient();

    // 1. Fetch current booking info to get the event date for validation
    const { data: currentBooking, error: fetchError } = await supabase
      .from("bookings")
      .select(`
        id,
        event_id,
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

    // 3. Update the booking
    const { error } = await supabase
      .from("bookings")
      .update(updates)
      .eq("id", bookingId);

    if (error) {
      console.error("Update booking error:", error);
      return { success: false, error: "Failed to update booking. Please try again." };
    }

    // Revalidate the page so it instantly shows the new team name and size!
    revalidatePath(`/manage-booking/${bookingId}`);
    
    return { success: true };
  } catch (err) {
    console.error("Action error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}