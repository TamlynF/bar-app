export const dynamic = "force-dynamic";

import { Trophy, Users, ListOrdered } from "lucide-react";
import { format } from "date-fns";
import { getQuizEvents, getEventTeams, getAllTimeLeaderboard } from "./actions";
import { InfoBadge, EmptyState, StatusPill } from "@/components/admin";
import LeaderboardEventFilter from "./_components/leaderboard-event-filter";
import EventTeams from "./_components/event-teams";
import AllTimeLeaderboard from "./_components/all-time-leaderboard";

const parseDate = (d: string) => new Date(d + "T00:00:00");

export default async function QuizLeaderboardsPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const { event } = await searchParams;
  const events = await getQuizEvents();

  if (events.length === 0) {
    return (
      <div className="mx-auto w-full px-2 py-2 sm:px-4 sm:py-0 md:px-6">
        <EmptyState
          icon={Trophy}
          title="No quiz events yet"
          description="Quiz events with at least one booked team will appear here, where you can record the winning team."
        />
      </div>
    );
  }

  const selectedEventId = event && events.some((e) => e.id === event) ? event : events[0].id;
  const selectedEvent = events.find((e) => e.id === selectedEventId)!;
  const eventLabel = selectedEvent.title || format(parseDate(selectedEvent.date), "dd MMM yyyy");
  const [teams, allTimeTeams] = await Promise.all([
    getEventTeams(selectedEventId),
    getAllTimeLeaderboard(100),
  ]);

  const winner = teams.find((team) => team.isWinner) ?? null;
  const totalGuests = teams.reduce((sum, t) => sum + (t.groupSize ?? 0), 0);

  return (
    <div className="mx-auto w-full space-y-4 px-2 py-2 sm:px-4 sm:py-0 md:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-wide text-admin-muted">Leaderboard</p>
          <h2 className="mt-1 truncate text-xl leading-tight font-bold tracking-tight text-admin-ink">
            {eventLabel}
          </h2>
        </div>
        <LeaderboardEventFilter events={events} selectedEventId={selectedEventId} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatusPill
          tone={winner ? "success" : "neutral"}
          icon={<Trophy className="h-3 w-3" />}
          showLabelOnMobile
        >
          {winner ? `Winner: ${winner.groupName}` : "No winner recorded"}
        </StatusPill>
        <InfoBadge icon={<ListOrdered className="h-3 w-3" />}>
          {teams.length} confirmed
        </InfoBadge>
        {totalGuests > 0 && (
          <InfoBadge icon={<Users className="h-3 w-3" />}>{totalGuests} guests</InfoBadge>
        )}
      </div>

      <EventTeams key={selectedEventId} eventId={selectedEventId} teams={teams} />

      <section className="pt-2">
        <AllTimeLeaderboard entries={allTimeTeams} />
      </section>
    </div>
  );
}
