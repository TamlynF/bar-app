import { createClient } from "@/lib/supabase/server";
import PromoContentClient from "./promo-content-client";

export default async function PromoContentPage() {
  const supabase = await createClient();

  const { data: promos, error } = await supabase
    .from("promo_content")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) {
    console.error("Error fetching promo content:", error);
  }

  return <PromoContentClient initialPromos={promos || []} />;
}
