import { createClient } from "@/lib/supabase/server";
import TeamsClient from "./teams-client";

export default async function TeamsPage() {
  const supabase = await createClient();

  // Fetch the booking scores and join the associated bookings and events!
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

  // The client component will handle aggregating these scores by team_name
  return <TeamsClient initialScores={scores || []} />;
}
