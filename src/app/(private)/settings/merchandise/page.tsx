import { createClient } from "@/lib/supabase/server";
import MerchandiseClient from "./merchandise-client";

export default async function MerchandisePage() {
  const supabase = await createClient();

  const { data: merchandise, error } = await supabase
    .from("merchandise")
    .select("*")
    .order("display_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    console.error("Error fetching merchandise:", error);
  }

  return <MerchandiseClient initialMerchandise={merchandise || []} />;
}
