"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateBingoSpecialRequests(
  bookingId: string | number,
  specialRequests: string
) {
  try {
    const supabase = await createClient();
    const { data: booking } = await supabase
      .from("bookings")
      .select("contact_id")
      .eq("id", bookingId)
      .single();

    const { error } = await supabase
      .from("bookings")
      .update({
        special_requests: specialRequests || null,
        updated_by_contact_id: booking?.contact_id ?? null,
        updated_by: null,
      })
      .eq("id", bookingId);

    if (error) return { success: false, error: "Failed to save. Please try again." };

    revalidatePath(`/book/bingo/manage-booking/${bookingId}`);
    return { success: true };
  } catch {
    return { success: false, error: "An unexpected error occurred." };
  }
}
