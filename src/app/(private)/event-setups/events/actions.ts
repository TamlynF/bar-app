"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { publicBookingUrl } from "@/lib/booking-links";
import { isBookingGrouping } from "@/lib/booking-grouping";
import { validateEventForm, type EventClashCandidate } from "@/lib/event-form-validation";

export async function saveEventAction(formData: FormData) {
  const supabase = await createClient();

  const id = formData.get("id")?.toString();
  const isBookable = formData.get("is_bookable") === "on";
  const date = formData.get("date")?.toString() ?? "";
  const eventTypesId = parseInt(formData.get("event_types_id")?.toString() || "0", 10);
  const eventSubtypesId = parseInt(formData.get("event_subtypes_id")?.toString() || "0", 10);
  const manualUrl = formData.get("booking_page_url")?.toString() || null;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  const payload = {
    title: formData.get("title")?.toString() || "",
    tagline: formData.get("tagline")?.toString() || "",
    date,
    start_time: formData.get("start_time")?.toString() || null,
    end_time: formData.get("end_time")?.toString() || null,
    payment_amount: parseFloat(formData.get("payment_amount")?.toString() || "0"),
    event_types_id: eventTypesId,
    event_subtypes_id: eventSubtypesId,
    host_employee_id: formData.get("host_employee_id") ? parseInt(formData.get("host_employee_id") as string, 10) : null,
    seating_required: formData.get("seating_required") === "on",
    is_active: formData.get("is_active") === "on",
    is_fully_booked: formData.get("is_fully_booked") === "on",
    group_name: formData.get("group_name")?.toString() || null,
    booking_id: formData.get("booking_id") ? parseInt(formData.get("booking_id") as string, 10) : null,
    external_link: formData.get("external_link")?.toString() || null,
    karaoke_request_url: formData.get("karaoke_request_url")?.toString() || null,
    is_bookable: isBookable,
    booking_config: JSON.parse(formData.get("booking_config")?.toString() || "{}"),
    booking_card_title: formData.get("booking_card_title")?.toString() || null,
    booking_card_tagline: formData.get("booking_card_tagline")?.toString() || null,
    booking_card_icon: formData.get("booking_card_icon")?.toString() || null,
    booking_card_badge: formData.get("booking_card_badge")?.toString() || null,
    // A non-bookable event has no shareable link, so drop any stored QR code.
    ...(isBookable ? {} : { booking_qr_url: null }),
  };

  // --- Validation (shared with the client form via @/lib/event-form-validation) ---
  const { data: sameDay } = await supabase
    .from("events")
    .select("id, title, start_time, end_time, date, is_active")
    .eq("date", date);

  const validation = validateEventForm(
    {
      eventTypesId: eventTypesId || null,
      eventSubtypesId: eventSubtypesId || null,
      title: formData.get("title")?.toString() ?? "",
      date,
      startTime: formData.get("start_time")?.toString() ?? "",
      endTime: formData.get("end_time")?.toString() ?? "",
    },
    (sameDay ?? []) as EventClashCandidate[],
    id ?? null
  );
  if (!validation.ok) {
    if (validation.code === "missing_fields") {
      return { error: "Fill in event type, sub-type, title, date, start time and end time." };
    }
    if (validation.code === "end_before_start") {
      return { error: "End time must be after the start time." };
    }
    const friendlyDate = new Date(date + "T00:00:00").toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const c = validation.clash;
    return { error: `Clashes with an active event on ${friendlyDate}: ${c.title} (${c.start}${c.end ? ` - ${c.end}` : ""}).` };
  }

  // Fetch the category's grouping to determine the right booking URL path
  const { data: type } = await supabase.from("event_types").select("booking_grouping")
    .eq("id", eventTypesId).maybeSingle();
  const grouping = isBookingGrouping(type?.booking_grouping) ? type.booking_grouping : "per_event";

  function computeBookingUrl(eventId: number | string): string | null {
    return publicBookingUrl({
      grouping,
      isBookable,
      manualUrl,
      siteUrl,
      eventTypesId,
      eventSubtypesId: eventSubtypesId || null,
      eventId,
    });
  }

  // Resolve current logged-in user to an employee id
  let currentEmployeeId: number | null = null;
  const { data: { user } } = await supabase.auth.getUser();
  console.log("Current user:", user);
  if (user?.email) {
    const { data: emp } = await supabase.from("employees").select("id").eq("email", user.email).maybeSingle();
    console.log("Resolved employee:", emp);
    if (emp) currentEmployeeId = emp.id;
  }

  try {
    // Holds the freshly saved row so the client can refresh its view without a
    // round-trip — the list still updates via revalidatePath below.
    let savedEvent;
    if (id) {
      const { data: prevEvent } = await supabase.from("events").select("is_active").eq("id", id).maybeSingle();
      const bookingPageUrl = computeBookingUrl(id);
      const { data: updated, error } = await supabase.from("events").update({
        ...payload,
        booking_page_url: bookingPageUrl,
        updated_by: currentEmployeeId,
        updated_at: new Date().toISOString(),
      }).eq("id", id).select("*").single();
      if (error) throw error;
      savedEvent = updated;

      // When an event becomes inactive and its date has passed, purge its draft
      // exclusion log (generated_quiz_questions) for this event.
      const today = new Date().toISOString().split("T")[0];
      if (payload.is_active === false && prevEvent?.is_active !== false && date < today) {
        await supabase.from("generated_quiz_questions").delete().eq("events_id", parseInt(id, 10));
      }
    } else {
      // INSERT first to get the generated ID, then compute and store the URL
      const { data: inserted, error: insertError } = await supabase.from("events").insert({
        ...payload,
        created_by: currentEmployeeId,
        updated_by: currentEmployeeId,
      }).select("*").single();
      if (insertError) throw insertError;
      savedEvent = inserted;

      const bookingPageUrl = computeBookingUrl(inserted.id);
      if (bookingPageUrl !== null) {
        const { data: urlUpdated, error: urlError } = await supabase.from("events")
          .update({ booking_page_url: bookingPageUrl })
          .eq("id", inserted.id).select("*").single();
        if (urlError) throw urlError;
        savedEvent = urlUpdated;
      }
    }

    revalidatePath("/event-setups/events");
    return { success: true, event: savedEvent };
  } catch (error) {
    console.error("Error saving event:", error);
    return { error: error instanceof Error ? error.message : "Failed to save event." };
  }
}

/**
 * Persist (or clear) the QR code for an event's shareable booking link. The QR is
 * generated client-side as a PNG data URL; pass null to remove it.
 */
export async function setEventQr(id: number, qrDataUrl: string | null) {
  const supabase = await createClient();
  try {
    const { error } = await supabase.from("events").update({ booking_qr_url: qrDataUrl }).eq("id", id);
    if (error) throw error;
    revalidatePath("/event-setups/events");
    return { success: true };
  } catch (error) {
    console.error("Error saving event QR:", error);
    return { error: error instanceof Error ? error.message : "Failed to save QR code." };
  }
}

export async function deleteEventAction(id: number) {
  const supabase = await createClient();
  try {
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/event-setups/events");
    return { success: true };
  } catch (error) {
    console.error("Error deleting event:", error);
    return { error: error instanceof Error ? error.message : "Failed to delete event." };
  }
}