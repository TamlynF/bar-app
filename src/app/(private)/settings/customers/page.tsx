import { createClient } from "@/lib/supabase/server";
import CustomersClient from "./customers-client";

export default async function CustomersPage() {
  const supabase = await createClient();

  const { data: contacts, error } = await supabase
    .from("contacts")
    .select("*")
    .order("full_name", { ascending: true });

  if (error) {
    console.error("Error fetching contacts:", error);
  }

  return <CustomersClient initialContacts={contacts || []} />;
}