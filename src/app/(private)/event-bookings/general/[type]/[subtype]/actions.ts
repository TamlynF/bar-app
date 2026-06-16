"use server";

import { createClient } from "@/lib/supabase/server";

export async function getEventsForType(type: string, subType: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("id, date, title, event_types!inner(name), event_subtypes!inner(name)")
    .ilike("event_types.name", type)
    .ilike("event_subtypes.name", subType)
    .order("date", { ascending: false });
  return (data ?? []).map(e => ({
    id: String(e.id),
    date: String(e.date),
    title: (e as { title?: string | null }).title ?? null,
  }));
}

export async function getBookingsForType(
  type: string,
  subType: string,
  selectedEventId: string | null,
) {
  const supabase = await createClient();
  let query = supabase
    .from("bookings")
    .select(`
      id,
      event_id,
      group_name,
      group_size,
      status,
      payment_status,
      paid_amount,
      total_amount,
      special_requests,
      booking_created_at: created_at,
      contacts!bookings_contact_id_fkey(full_name, email, country_code, phone_no),
      events!bookings_event_id_fkey!inner(
        event_date: date,
        event_start_time: start_time,
        event_end_time: end_time,
        event_title: title,
        event_payment_amount: payment_amount,
        event_types!inner(category: name),
        event_subtypes!inner(sub_type: name)
      ),
      booking_table_mappings(
        tables(tables_id: id, tables_name: name, tables_capacity: max_capacity)
      )
    `)
    .ilike("events.event_types.name", type)
    .ilike("events.event_subtypes.name", subType)
    .order("date", { referencedTable: "events", ascending: false })
    .order("group_name", { ascending: true });

  if (selectedEventId) query = query.eq("event_id", selectedEventId);

  const { data, error } = await query;
  if (error) {
    console.error("getBookingsForType error:", error);
    return [];
  }
  return data ?? [];
}

export async function getEventDetailsForType(eventId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select(`
      id,
      date,
      start_time,
      end_time,
      title,
      tagline,
      payment_amount,
      host:employees!events_host_employee_id_fkey(full_name),
      event_types!inner(name),
      event_subtypes!inner(name, color)
    `)
    .eq("id", eventId)
    .maybeSingle();
  return data;
}
