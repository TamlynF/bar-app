import { createClient } from "@/lib/supabase/server";
import CompanyInfoClient from "./company-info-client";

export default async function CompanyInfoPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("company_information")
    .select("*")
    .limit(1)
    .single();

  if (error) {
    console.error("Error fetching company info:", error);
  }

  return <CompanyInfoClient initialData={data} />;
}
