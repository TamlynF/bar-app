import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncSquareCatalog } from "@/lib/square-catalog-sync";
import { refreshSessionMixers } from "./square-mixers";
import { refreshStockTracking } from "./square-stock-tracking";

/* Brings a session's mixer prices and stock-tracking flags up to date with
   Square: the catalog copy is refreshed first, then both are read from it.
   Run when a market opens, when the sandbox catalog is seeded and when
   Square's catalog webhook fires. When Square cannot be reached the copy is
   left as it was; with requireSquare (the webhook, so Square retries) that is
   an error, otherwise the session is set from the last copy. catalogFresh
   skips the copy when the caller has just refreshed it. */
export async function refreshSessionFromSquare(
  supabase: SupabaseClient,
  sessionId: number,
  options: { requireSquare: boolean; catalogFresh?: boolean }
): Promise<{ catalogError: string | null }> {
  const catalog = options.catalogFresh ? null : await syncSquareCatalog(createAdminClient());
  const catalogError = catalog?.status === "error" ? catalog.error : null;
  if (catalogError) {
    if (options.requireSquare) throw new Error(`Square catalog refresh failed: ${catalogError}`);
    console.error("[market] catalog refresh failed, using the last copy:", catalogError);
  }

  const outcomes = await Promise.allSettled([
    refreshSessionMixers(supabase, sessionId),
    refreshStockTracking(supabase, sessionId),
  ]);
  for (const outcome of outcomes) {
    if (outcome.status === "rejected") console.error("[market] session refresh from the catalog copy failed:", outcome.reason);
  }
  return { catalogError };
}
