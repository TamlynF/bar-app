"use server"

import { createClient } from "@/lib/supabase/server"
import { getFreeTablesForEvent } from "@/lib/table-allocation"

export async function getAvailableTablesForEvent(eventId: string, groupSize: number, currentTableId?: string) {
  const supabase = await createClient();
  return getFreeTablesForEvent(supabase, Number(eventId), {
    groupSize,
    excludeTableId: currentTableId ? Number(currentTableId) : undefined,
  });
}
