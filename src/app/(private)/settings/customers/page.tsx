import { createClient } from "@/lib/supabase/server";
import CustomersClient, { type ContactRecord } from "./customers-client";
import { readContactActivity } from "./activity";

export default async function CustomersPage() {
  const supabase = await createClient();

  const [{ data: contacts, error }, { data: employees }] = await Promise.all([
    supabase.from("contacts").select("*").order("full_name", { ascending: true }),
    supabase.from("employees").select("id, full_name").order("full_name", { ascending: true }),
  ]);

  if (error) {
    console.error("Error fetching contacts:", error);
  }

  const rows = (contacts ?? []) as ContactRecord[];
  const activity = await readContactActivity(
    supabase,
    rows.map((c) => ({ id: c.id, email: c.email })),
  );

  return (
    <CustomersClient
      initialContacts={rows}
      employees={employees ?? []}
      activity={activity}
    />
  );
}
