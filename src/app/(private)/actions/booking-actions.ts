"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function getBookings(type: string, subType: string, selectedDate: string | null) {
  //console.log("Fetching bookings with filters:", { type, subType, selectedDate })
  try {
    const supabase = await createClient()

    let query = supabase
      .from("bookings")
      .select(`
          id,
          event_id,
          group_name,
          team_id,
          contact_id,
          group_size,
          paid_amount,
          total_amount,
          status,
          special_requests,
          booking_created_at: created_at,
          contacts(
            full_name,
            email,
            country_code,
            phone_no
          ),
          events!inner(
            event_date: date,
        event_start_time: start_time,
        event_end_time: end_time,
        event_title: title,
        event_description: description,
        event_payment_amount: payment_amount,
            event_types!inner(
              category: type,
              sub_type
            )
          ),
          booking_table_mappings(
            tables(
            tables_id: id,  
            tables_name: name,
              tables_capacity: max_capacity,
              tables_description: description,
              tables_available: available              
            )
          ),
          booking_scores(
            score,
            is_winner
          )
        `)
      .ilike("events.event_types.type", type)
      .ilike("events.event_types.sub_type", subType)
      .order('date', { referencedTable: 'events', ascending: false })
      .order('group_name', { ascending: true });

    if (selectedDate) {
      query = query.eq("events.date", selectedDate);
    }

    const { data: bookings, error } = await query;
    //console.log("Fetched bookings:", { bookings, error })

    if (error) {
      console.error("Error fetching bookings:", error)
      throw new Error("Failed to fetch bookings")
    }

    return bookings
  } catch (error) {
    console.error("Bookings data source unavailable:", error)
    throw new Error("An unexpected error occurred.")
  }
}

export async function getAvailableTables() {
  try {
    const supabase = await createClient();

    const { data: tables, error } = await supabase
      .from("tables")
      .select("max_capacity")
      .eq("available", true);
    
    if (error) {
      console.error("Error fetching available tables:", error)
      throw new Error("Failed to fetch available tables")
    }
    
    return tables;
  } catch (error) {
    console.error("Error fetching available tables:", error);
    throw new Error("Failed to fetch available tables");
  }
}

export async function getQuizEvents(type: string, subType: string) {
  try {
    const supabase = await createClient();

     const { data: events, error } = await supabase
      .from("events")
      .select("date, event_types!inner(category: type, sub_type)")
      .ilike("event_types.type", type)
      .ilike("event_types.sub_type", subType)


    
    if (error) {
      console.error("Error fetching quiz events:", error)
      throw new Error("Failed to fetch quiz events")
    }
    
    return events;
  } catch (error) {
    console.error("Error fetching quiz events:", error);
    throw new Error("Failed to fetch quiz events");
  }
}

export async function updateBookingStatus(id: string, status: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from("bookings")
    .update({ status: status.toLowerCase() })
    .eq("id", id)

  if (error) {
    console.error("Error updating booking status:", error)
    throw new Error("Failed to update booking status")
  }

  revalidatePath("/dashboard")
}

export async function deleteBooking(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("bookings")
    .delete()
    .eq("id", id)

  if (error) throw new Error("Failed to delete")
  revalidatePath("/dashboard")
}