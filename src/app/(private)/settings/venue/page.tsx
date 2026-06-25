import { createClient } from "@/lib/supabase/server";
import VenueEditorClient from "./_components/venue-editor-client";
import type { Feature, Fixture, Obstacle, RoomOutline } from "@/lib/floor-plan/types";

export default async function VenueLayoutPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("company_information")
    .select("id, name, max_capacity, room_outline, obstacles, fixtures, features")
    .order("id", { ascending: true })
    .limit(1)
    .single();

  if (error) {
    console.error("Error fetching company venue geometry:", error);
  }

  return (
    <VenueEditorClient
      companyId={data?.id ?? null}
      companyName={data?.name ?? null}
      initialRoom={(data?.room_outline as RoomOutline | null) ?? null}
      initialObstacles={(data?.obstacles as Obstacle[] | null) ?? []}
      initialFixtures={(data?.fixtures as Fixture[] | null) ?? []}
      initialFeatures={(data?.features as Feature[] | null) ?? []}
    />
  );
}
