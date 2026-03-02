"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateBooking(bookingId: string | number, updates: { group_name?: string, group_size?: number }) {
  try {
    const supabase = await createClient();

    // Update the booking with the new details
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