import type { SupabaseClient } from "@supabase/supabase-js";

export type PendingRequestCounts = {
  band: number;
  privateHire: number;
  enquiries: number;
  total: number;
};

export async function getPendingRequestCounts(
  supabase: SupabaseClient
): Promise<PendingRequestCounts> {
  const [{ count: band }, { count: privateHire }, { count: enquiries }] =
    await Promise.all([
      supabase
        .from("band_booking_requests")
        .select("id", { count: "exact", head: true })
        .in("status", ["new", "reviewing"]),
      supabase
        .from("private_hire_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("enquiries")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
    ]);

  return {
    band: band ?? 0,
    privateHire: privateHire ?? 0,
    enquiries: enquiries ?? 0,
    total: (band ?? 0) + (privateHire ?? 0) + (enquiries ?? 0),
  };
}
