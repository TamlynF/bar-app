"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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
  };

  // Fetch the subtype to determine the right booking URL path
  const { data: sub } = await supabase.from("event_subtypes").select("name, is_quiz")
    .eq("id", eventSubtypesId).maybeSingle();
  const subName = sub?.name?.toLowerCase() ?? "";

  function computeBookingUrl(eventId: number | string): string | null {
    if (!isBookable) return null;
    if (manualUrl) return manualUrl;
    if (sub?.is_quiz)       return `${siteUrl}/book/quiz?date=${date}`;
    if (subName === "bingo") return `${siteUrl}/book/bingo?date=${date}`;
    return `${siteUrl}/book/event/${eventId}`;
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
    if (id) {
      const { data: prevEvent } = await supabase.from("events").select("is_active").eq("id", id).maybeSingle();
      const bookingPageUrl = computeBookingUrl(id);
      const { error } = await supabase.from("events").update({
        ...payload,
        booking_page_url: bookingPageUrl,
        updated_by: currentEmployeeId,
        updated_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;

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
      }).select("id").single();
      if (insertError) throw insertError;

      const bookingPageUrl = computeBookingUrl(inserted.id);
      if (bookingPageUrl !== null) {
        const { error: urlError } = await supabase.from("events")
          .update({ booking_page_url: bookingPageUrl })
          .eq("id", inserted.id);
        if (urlError) throw urlError;
      }
    }

    revalidatePath("/event-setups");
    return { success: true };
  } catch (error) {
    console.error("Error saving event:", error);
    return { error: error instanceof Error ? error.message : "Failed to save event." };
  }
}

export async function deleteEventAction(id: number) {
  const supabase = await createClient();
  try {
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/event-setups");
    return { success: true };
  } catch (error) {
    console.error("Error deleting event:", error);
    return { error: error instanceof Error ? error.message : "Failed to delete event." };
  }
}