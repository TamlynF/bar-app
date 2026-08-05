import { createClient } from "@/lib/supabase/server";
import CompanyInfoClient from "./company-info-client";
import type { Feature, Fixture, Obstacle, RoomOutline } from "@/lib/floor-plan/types";

export default async function CompanyInfoPage() {
  const supabase = await createClient();

  const [{ data, error }, { data: employees }] = await Promise.all([
    supabase.from("company_information").select("*").limit(1).single(),
    supabase.from("employees").select("id, full_name").order("full_name", { ascending: true }),
  ]);

  if (error) {
    console.error("Error fetching company info:", error);
  }

  const room = (data?.room_outline as RoomOutline | null) ?? null;
  const hasVenuePlan =
    (room?.points?.length ?? 0) >= 3 ||
    ((data?.obstacles as Obstacle[] | null) ?? []).length > 0 ||
    ((data?.fixtures as Fixture[] | null) ?? []).length > 0 ||
    ((data?.features as Feature[] | null) ?? []).length > 0;

  return (
    <CompanyInfoClient
      initialData={data}
      employees={employees ?? []}
      hasVenuePlan={hasVenuePlan}
    />
  );
}
