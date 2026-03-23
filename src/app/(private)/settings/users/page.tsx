import { createClient } from "@/lib/supabase/server";
import EmployeesClient from "./users-client";

export default async function TablesPage() {
  const supabase = await createClient();

  const { data: employees, error } = await supabase
    .from("employees")
    .select(`
      *,
      created_by_employee:employees!created_by(full_name, role),
      updated_by_employee:employees!updated_by(full_name, role)
    `)
    .order("full_name", { ascending: true });

  if (error) {
    console.error("Error fetching tables:", error);
  }

  return <EmployeesClient initialEmployees={employees || []} />;
}