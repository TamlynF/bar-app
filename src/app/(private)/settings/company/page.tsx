import { createClient } from "@/lib/supabase/server";
import CompanyInfoClient from "./company-info-client";
import VenueEditorClient from "../venue/_components/venue-editor-client";
import type { Feature, Fixture, Obstacle, RoomOutline } from "@/lib/floor-plan/types";

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

  return (
    <div className="space-y-4">
      <CompanyInfoClient initialData={data} />

      <div className="mx-2 border-t border-[#E6DFC8] sm:mx-4" />

      <VenueEditorClient
        companyId={data?.id ?? null}
        companyName={data?.name ?? null}
        initialRoom={(data?.room_outline as RoomOutline | null) ?? null}
        initialObstacles={(data?.obstacles as Obstacle[] | null) ?? []}
        initialFixtures={(data?.fixtures as Fixture[] | null) ?? []}
        initialFeatures={(data?.features as Feature[] | null) ?? []}
      />
    </div>
  );
}
