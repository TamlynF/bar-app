import { createClient } from "@/lib/supabase/server";
import MerchandiseClient from "./merchandise-client";

export default async function MerchandisePage() {
  const supabase = await createClient();

  const [{ data: merchandise, error }, { data: employees }] = await Promise.all([
    supabase
      .from("merchandise")
      .select("*")
      .order("display_order", { ascending: true })
      .order("id", { ascending: true }),
    supabase.from("employees").select("id, full_name").order("full_name", { ascending: true }),
  ]);

  if (error) {
    console.error("Error fetching merchandise:", error);
  }

  return (
    <MerchandiseClient
      initialMerchandise={merchandise || []}
      employees={employees ?? []}
    />
  );
}
