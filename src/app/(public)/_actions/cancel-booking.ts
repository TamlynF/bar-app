"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { updateFullyBookedStatus } from "@/lib/update-fully-booked";
import { clearMappingOnStatusChange } from "@/lib/table-allocation";

export async function cancelBooking(bookingId: string | number) {
  try {
    const supabase = await createClient();

    const { data: booking } = await supabase
      .from("bookings")
      .select("contact_id, event_id")
      .eq("id", bookingId)
      .single();

    const { error } = await supabase
      .from("bookings")
      .update({
        status: "cancelled",
        updated_by_contact_id: booking?.contact_id ?? null,
        updated_by: null,
      })
      .eq("id", bookingId);

    if (error) {
      console.error("Cancel booking error:", error);
      return { success: false, error: "Failed to cancel booking. Please try again or contact us." };
    }

    await clearMappingOnStatusChange(supabase, bookingId);

    if (booking?.event_id) {
      await updateFullyBookedStatus(supabase, booking.event_id);
    }

    revalidatePath(`/manage-booking/${bookingId}`);
    revalidatePath("/dashboard");

    return { success: true };
  } catch (err) {
    console.error("Action error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}