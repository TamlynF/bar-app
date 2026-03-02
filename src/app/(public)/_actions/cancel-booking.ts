"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function cancelBooking(bookingId: string | number) {
  try {
    const supabase = await createClient();

    // Update the booking status to 'cancelled'
    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", bookingId);

    if (error) {
      console.error("Cancel booking error:", error);
      return { success: false, error: "Failed to cancel booking. Please try again or contact us." };
    }

    // Revalidate the page so it instantly shows the "Cancelled" status
    revalidatePath(`/manage-booking/${bookingId}`);
    
    return { success: true };
  } catch (err) {
    console.error("Action error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}