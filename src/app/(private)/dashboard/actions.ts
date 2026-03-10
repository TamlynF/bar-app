"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

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