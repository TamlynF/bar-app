import { createClient } from "@/lib/supabase/server";
import TablesClient from "./tables-client";

export default async function TablesPage() {
  const supabase = await createClient();

  const { data: tables, error } = await supabase
    .from("tables")
    .select("*")
    .order("id", { ascending: true });

  if (error) {
    console.error("Error fetching tables:", error);
  }

  return <TablesClient initialTables={tables || []} />;
}