import { createClient } from "@/lib/supabase/server";
import SpecialsClient from "./specials-client";

export default async function SpecialsPage() {
  const supabase = await createClient();

  const [{ data: specials, error }, { data: employees }] = await Promise.all([
    supabase
      .from("specials")
      .select("*")
      .order("display_order", { ascending: true })
      .order("id", { ascending: true }),
    supabase.from("employees").select("id, full_name").order("full_name", { ascending: true }),
  ]);

  if (error) {
    console.error("Error fetching specials:", error);
  }

  return <SpecialsClient initialSpecials={specials || []} employees={employees ?? []} />;
}
