"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { checkEventGroupName } from "./create-event-booking";
import { checkSeatingAvailability } from "./check-seating";
import { updateFullyBookedStatus } from "@/lib/update-fully-booked";
import {
  seatingApplies,
  allocateOnCreate,
  commitMapping,
  planSizeChange,
  applySizeChange,
} from "@/lib/table-allocation";

export async function updateBooking(
  bookingId: string | number,
  updates: {
    group_name?: string;
    group_size?: number;
    special_requests?: string; // Added special_requests
  }
) {
  try {
    const supabase = await createClient();

    const { data: currentBooking, error: fetchError } = await supabase
      .from("bookings")
      .select(`
        id,
        event_id,
        contact_id,
        status,
        group_size,
        events!bookings_event_id_fkey (date, seating_required, is_bookable)
      `)
      .eq("id", bookingId)
      .single();

    if (fetchError || !currentBooking) {
      return { success: false, error: "Booking not found." };
    }

    type EventRel = { date: string; seating_required: boolean; is_bookable: boolean };
    const eventData = currentBooking.events as EventRel | EventRel[] | null;
    const ev = Array.isArray(eventData) ? eventData[0] : eventData;
    const eventId = currentBooking.event_id as number;

    if (updates.group_name) {
      const { isAvailable } = await checkEventGroupName(updates.group_name, eventId, bookingId);
      if (!isAvailable) {
        return { success: false, error: "This name is already taken for this event." };
      }
    }

    const newSize = updates.group_size ?? currentBooking.group_size;
    const sizeChanged =
      updates.group_size !== undefined && updates.group_size !== currentBooking.group_size;
    let finalStatus = currentBooking.status as string;

    const seated = ev
      ? seatingApplies({
          id: eventId,
          seating_required: ev.seating_required,
          is_bookable: ev.is_bookable,
        })
      : false;

    if (!seated && sizeChanged) {
      const { hasSpace } = await checkSeatingAvailability(eventId, newSize, bookingId);
      if (!hasSpace) {
        return {
          success: false,
          blocked: true,
          error: "There's no available space for that group size. Please contact the bar.",
        };
      }
    }

    if (seated) {
      const { data: mapping } = await supabase
        .from("booking_table_mappings")
        .select("table_id, tables(max_capacity)")
        .eq("booking_id", bookingId)
        .maybeSingle();

      const mappedTableId = (mapping?.table_id as number | undefined) ?? undefined;
      const tablesRel = mapping?.tables as { max_capacity: number } | { max_capacity: number }[] | null;
      const mappedCap = Array.isArray(tablesRel) ? tablesRel[0]?.max_capacity : tablesRel?.max_capacity;

      const isConfirmedMapped =
        currentBooking.status === "confirmed" && mappedTableId != null && mappedCap != null;

      if (isConfirmedMapped && sizeChanged) {
        const plan = await planSizeChange(supabase, {
          booking: {
            bookingId: Number(bookingId),
            groupSize: currentBooking.group_size,
            tableId: mappedTableId!,
            tableCapacity: mappedCap!,
          },
          newSize,
        });

        if (plan.outcome === "no_space") {
          return {
            success: false,
            blocked: true,
            error: "There's no available space for that group size. Please contact the bar.",
          };
        }

        await applySizeChange(supabase, plan, { bookingId, eventId, surface: "public" });
        finalStatus = "confirmed";
      } else if (!isConfirmedMapped && (sizeChanged || currentBooking.status !== "confirmed")) {
        const allocation = await allocateOnCreate(supabase, { eventId, groupSize: newSize });
        await supabase.from("booking_table_mappings").delete().eq("booking_id", bookingId);
        if (allocation.status === "confirmed") {
          const mapped = await commitMapping(supabase, {
            bookingId,
            eventId,
            tableId: allocation.table.id,
            groupSize: newSize,
          });
          finalStatus = mapped.ok ? "confirmed" : "waitlisted";
        } else {
          finalStatus = "waitlisted";
        }
      }
    }

    const { error: updateError } = await supabase
      .from("bookings")
      .update({
        ...updates,
        status: finalStatus,
        updated_by_contact_id: currentBooking.contact_id ?? null,
        updated_by: null,
      })
      .eq("id", bookingId);

    if (updateError) {
      console.error("Update booking error:", updateError);
      return { success: false, error: "Failed to update booking. Please try again." };
    }

    await updateFullyBookedStatus(supabase, eventId);

    revalidatePath(`/manage-booking/${bookingId}`);
    revalidatePath("/dashboard");
    revalidatePath("/event-bookings/quiz-bookings");

    return { success: true };
  } catch (err) {
    console.error("Action error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}
