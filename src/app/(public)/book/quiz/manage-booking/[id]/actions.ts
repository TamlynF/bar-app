"use server"

import { createClient } from "@/lib/supabase/server"
import { getFreeTablesForEvent } from "@/lib/table-allocation"

/**
 * Fetches tables that are available for a specific event and can accommodate the group size.
 * Delegates to the shared table-allocation module (single source of truth). The
 * booking's own current table is re-included via excludeTableId so it stays selectable.
 */
export async function getAvailableTablesForEvent(eventId: string, groupSize: number, currentTableId?: string) {
  const supabase = await createClient();
  return getFreeTablesForEvent(supabase, Number(eventId), {
    groupSize,
    excludeTableId: currentTableId ? Number(currentTableId) : undefined,
  });
}
