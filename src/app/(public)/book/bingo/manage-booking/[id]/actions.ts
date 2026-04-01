"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateBingoSpecialRequests(
  bookingId: string | number,
  specialRequests: string
) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("bookings")
      .update({ special_requests: specialRequests || null })
      .eq("id", bookingId);

    if (error) return { success: false, error: "Failed to save. Please try again." };

    revalidatePath(`/book/bingo/manage-booking/${bookingId}`);
    return { success: true };
  } catch {
    return { success: false, error: "An unexpected error occurred." };
  }
}
