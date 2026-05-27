import { createClient } from "@/lib/supabase/server";
import SpecialsClient from "./specials-client";

export default async function SpecialsPage() {
  const supabase = await createClient();

  const { data: specials, error } = await supabase
    .from("specials")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) {
    console.error("Error fetching specials:", error);
  }

  return <SpecialsClient initialSpecials={specials || []} />;
}
