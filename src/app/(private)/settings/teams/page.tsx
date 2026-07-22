import { createClient } from "@/lib/supabase/server";
import TeamsClient from "./teams-client";

export default async function TeamsPage() {
  const supabase = await createClient();

  const { data: scores, error } = await supabase
    .from("booking_scores")
    .select(`
      id,
      score,
      is_winner,
      created_at,
      bookings (
        id,
        group_name
      ),
      events (
        id,
        title,
        date
      )
    `);

  if (error) {
    console.error("Error fetching team scores:", error);
  }

  return <TeamsClient initialScores={scores || []} />;
}
