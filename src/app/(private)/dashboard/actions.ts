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

  // Refresh the dashboard data
  revalidatePath("/dashboard")
}