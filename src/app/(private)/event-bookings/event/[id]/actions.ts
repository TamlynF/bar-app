"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { updateFullyBookedStatus } from "@/lib/update-fully-booked";
import {
  clearMappingOnStatusChange,
  planConfirmSeating,
  commitMapping,
  seatingErrorMessage,
} from "@/lib/table-allocation";

export async function updateBookingStatusAction(bookingId: number, status: string) {
  const supabase = await createClient();

  let currentEmployeeId: number | null = null;
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.email) {
    const { data: emp } = await supabase.from("employees").select("id").eq("email", user.email).maybeSingle();
    if (emp) currentEmployeeId = emp.id;
  }

  try {
    const { data: bookingRow } = await supabase
      .from("bookings")
      .select("event_id, group_size")
      .eq("id", bookingId)
      .single();
    const eventId = bookingRow?.event_id as number | null;
    const groupSize = (bookingRow?.group_size as number) ?? 0;
    const wantConfirmed = status.toLowerCase() === "confirmed";

    let tableToAssign = null;
    if (wantConfirmed && eventId != null) {
      const plan = await planConfirmSeating(supabase, { eventId, bookingId, groupSize });
      if (!plan.ok) return { error: seatingErrorMessage("no_table") };
      tableToAssign = plan.tableToAssign;
    }

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

    if (wantConfirmed) {
      if (tableToAssign && eventId != null) {
        await commitMapping(supabase, { bookingId, eventId, tableId: tableToAssign.id, groupSize });
      }
    } else {
      await clearMappingOnStatusChange(supabase, bookingId);
    }
    if (eventId != null) await updateFullyBookedStatus(supabase, eventId);

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
