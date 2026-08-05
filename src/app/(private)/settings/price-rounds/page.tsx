import { createClient } from "@/lib/supabase/server";
import PriceRoundsClient, { type PriceRound } from "./price-rounds-client";

export default async function PriceRoundsSettingsPage() {
  const supabase = await createClient();

  const [{ data: rounds, error }, { data: employees }] = await Promise.all([
    supabase
      .from("price_benchmarks")
      .select("*")
      .order("display_order", { ascending: true }),
    supabase.from("employees").select("id, full_name").order("full_name", { ascending: true }),
  ]);

  if (error) console.error("Error fetching price rounds:", error);

  return (
    <PriceRoundsClient
      initialRounds={((rounds || []) as PriceRound[]) ?? []}
      employees={employees ?? []}
    />
  );
}
