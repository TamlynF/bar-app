"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateBookingStatusAction(bookingId: number, status: string) {
  const supabase = await createClient();

  let currentEmployeeId: number | null = null;
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.email) {
    const { data: emp } = await supabase.from("employees").select("id").eq("email", user.email).maybeSingle();
    if (emp) currentEmployeeId = emp.id;
  }

  try {
    const { error } = await supabase
      .from("bookings")
      .update({
        status,
        updated_by: currentEmployeeId,
        updated_by_contact_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookingId);
    if (error) throw error;

    revalidatePath("/event-bookings");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Error updating booking status:", error);
    return { error: error instanceof Error ? error.message : "Failed to update booking." };
  }
}

export async function cancelBookingAction(bookingId: number) {
  return updateBookingStatusAction(bookingId, "cancelled");
}
