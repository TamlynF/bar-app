import type { SupabaseClient } from "@supabase/supabase-js";

export const CATALOG_VERSION_EVENT = "catalog.version.updated";

/* Called from the Square webhook when the catalog version changes: whatever
   the live session last pushed is now what the till will charge, so promote
   each instrument's synced price to its confirmed price and stamp the session.
   The board prefers confirmed prices whenever a session has ever received
   one of these, so a venue that has not enabled the webhook keeps working
   off synced prices. */
export async function confirmCatalogWrite(supabase: SupabaseClient, now: Date = new Date()): Promise<number> {
  const { data: live } = await supabase
    .from("market_sessions")
    .select("id")
    .eq("status", "live")
    .maybeSingle();
  if (!live) return 0;

  const { data: rows, error } = await supabase
    .from("market_instruments")
    .select("id, square_synced_price")
    .eq("session_id", live.id)
    .not("square_synced_price", "is", null);
  if (error) throw error;

  await Promise.all(
    ((rows ?? []) as { id: number; square_synced_price: number | string }[]).map((row) =>
      supabase
        .from("market_instruments")
        .update({ square_confirmed_price: Number(row.square_synced_price) })
        .eq("id", row.id)
    )
  );
  const { error: sessionError } = await supabase
    .from("market_sessions")
    .update({ square_catalog_confirmed_at: now.toISOString() })
    .eq("id", live.id);
  if (sessionError) throw sessionError;
  return rows?.length ?? 0;
}

const CONFIRMATION_GRACE_MS = 90 * 1000;

/* Which price the public may see for a linked drink. Once a session has had a
   confirmation, show the confirmed price - unless the confirmation has fallen
   more than a minute and a half behind the last write (webhook down), in
   which case the synced price is the least-wrong thing to show. */
export function publicTillPrice(
  session: { square_last_write_at?: string | null; square_catalog_confirmed_at?: string | null },
  instrument: { square_synced_price: number | string | null; square_confirmed_price?: number | string | null }
): number | null {
  const synced = instrument.square_synced_price == null ? null : Number(instrument.square_synced_price);
  const confirmedAt = session.square_catalog_confirmed_at ? new Date(session.square_catalog_confirmed_at).getTime() : null;
  if (confirmedAt == null) return synced;
  const lastWrite = session.square_last_write_at ? new Date(session.square_last_write_at).getTime() : 0;
  if (lastWrite - confirmedAt > CONFIRMATION_GRACE_MS) return synced;
  const confirmed = instrument.square_confirmed_price == null ? null : Number(instrument.square_confirmed_price);
  return confirmed ?? synced;
}
