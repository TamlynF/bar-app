"use client";

import { useState, useMemo } from "react";
import { Trophy, Medal, Target, Users, Calendar, Hash, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useRecordSheet,
  RecordSheet,
  RecordList,
  ListRow,
  ListSearchInput,
  InfoBadge,
  StatusPill,
  EmptyState,
  DetailCard,
  DetailCell,
} from "@/components/admin";

export type RawBookingScore = {
  id: number;
  score: number | null;
  is_winner: boolean | null;
  created_at: string;
  bookings: {
    id: number;
    group_name: string | null;
  } | { id: number; group_name: string | null; }[] | null;
  events: {
    id: number;
    title: string | null;
    date: string;
  } | { id: number; title: string | null; date: string; }[] | null;
};

export type TeamStats = {
  team_name: string;
  quizzes_attended: number;
  total_score: number;
  wins: number;
  history: RawBookingScore[];
};

function eventOf(record: RawBookingScore) {
  return Array.isArray(record.events) ? record.events[0] : record.events;
}

function formatEventDate(date?: string | null) {
  if (!date) return "Unknown date";
  return new Date(date + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function averageScore(team: TeamStats): string {
  if (team.quizzes_attended === 0) return "-";
  return (team.total_score / team.quizzes_attended).toFixed(1);
}

export default function TeamsClient({ initialScores = [] }: { initialScores: RawBookingScore[] }) {
  const [query, setQuery] = useState("");

  const teamLeaderboard = useMemo(() => {
    const statsMap: Record<string, TeamStats> = {};

    initialScores.forEach((record) => {
      const booking = Array.isArray(record.bookings) ? record.bookings[0] : record.bookings;

      const teamName = booking?.group_name || "Unknown Team";

      if (!statsMap[teamName]) {
        statsMap[teamName] = {
          team_name: teamName,
          quizzes_attended: 0,
          total_score: 0,
          wins: 0,
          history: [],
        };
      }

      statsMap[teamName].quizzes_attended += 1;
      statsMap[teamName].total_score += record.score || 0;
      if (record.is_winner) {
        statsMap[teamName].wins += 1;
      }
      statsMap[teamName].history.push(record);
    });

    return Object.values(statsMap).sort((a, b) => {
      if (b.total_score !== a.total_score) {
        return b.total_score - a.total_score;
      }
      return b.wins - a.wins;
    });
  }, [initialScores]);

  const sheet = useRecordSheet<TeamStats>({
    records: teamLeaderboard,
    getId: (record) => record.team_name,
  });
  const { selected } = sheet;

  // The rank a team is filtered into has to stay the rank it holds on the whole
  // board, so it is read before the search narrows anything.
  const rankOf = useMemo(() => {
    const ranks = new Map<string, number>();
    teamLeaderboard.forEach((team, index) => ranks.set(team.team_name, index + 1));
    return ranks;
  }, [teamLeaderboard]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return teamLeaderboard;
    return teamLeaderboard.filter((team) => team.team_name.toLowerCase().includes(needle));
  }, [teamLeaderboard, query]);

  const sortedHistory = useMemo(() => {
    if (!selected) return [];
    return [...selected.history].sort((a, b) => {
      const dateA = eventOf(a)?.date ?? "";
      const dateB = eventOf(b)?.date ?? "";
      return dateB.localeCompare(dateA);
    });
  }, [selected]);

  return (
    <div className="mx-auto w-full space-y-3 px-2 py-3 sm:space-y-4 sm:px-4 sm:py-0 md:px-6">
      {teamLeaderboard.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No team scores recorded yet"
          description="Teams appear here once quiz scores have been entered"
        />
      ) : (
        <RecordList
          variant="panel"
          title="Teams & leaderboard"
          count={shown.length}
          toolbar={
            <ListSearchInput
              value={query}
              onChange={setQuery}
              label="Search teams"
              placeholder="Search by team name"
            />
          }
        >
          {shown.length === 0 ? (
            <div className="flex flex-col items-center gap-1 px-4 py-12 text-center">
              <SearchX className="mb-1 h-7 w-7 text-admin-muted opacity-30" />
              <p className="text-sm font-semibold text-admin-ink">No matches</p>
              <p className="text-[11px] text-admin-muted">
                Nothing here matches &ldquo;{query.trim()}&rdquo;
              </p>
            </div>
          ) : (
            shown.map((team) => {
              const rank = rankOf.get(team.team_name) ?? 0;
              const leading = rank === 1;
              return (
                <ListRow
                  key={team.team_name}
                  onClick={() => sheet.openView(team)}
                  status={
                    team.wins > 0 ? (
                      <StatusPill
                        tone="success"
                        icon={<Medal className="h-3 w-3" />}
                        className="sm:w-24 sm:justify-center"
                      >
                        {team.wins} {team.wins === 1 ? "win" : "wins"}
                      </StatusPill>
                    ) : (
                      <StatusPill tone="neutral" className="sm:w-24 sm:justify-center">
                        No wins
                      </StatusPill>
                    )
                  }
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold tabular-nums",
                      leading
                        ? "border-admin-gold/40 bg-admin-gold/10 text-admin-gold"
                        : "border-admin-line bg-admin-surface text-admin-muted",
                    )}
                  >
                    {leading ? <Trophy className="h-4 w-4" aria-hidden="true" /> : rank}
                    {leading && <span className="sr-only">Rank 1</span>}
                  </span>

                  {/* Fixed tracks so every column starts in the same place from
                      one row to the next, whatever a team is called. */}
                  <div className="min-w-0 flex-1 sm:grid sm:grid-cols-[minmax(0,1fr)_14rem_9rem_7rem] sm:items-center sm:gap-3">
                    <p className="min-w-0 truncate text-sm leading-snug font-semibold text-admin-ink">
                      {team.team_name}
                    </p>

                    <div className="mt-0.5 flex items-center gap-2 sm:mt-0">
                      <InfoBadge icon={<Hash className="h-3 w-3" />}>
                        {team.quizzes_attended}{" "}
                        {team.quizzes_attended === 1 ? "quiz" : "quizzes"}
                      </InfoBadge>
                      <InfoBadge icon={<Target className="h-3 w-3" />}>
                        {team.total_score} pts
                      </InfoBadge>
                    </div>

                    <p className="hidden items-center gap-1.5 text-[11px] font-medium text-admin-muted sm:flex">
                      <span className="sr-only">Average score</span>
                      <span className="tabular-nums">{averageScore(team)} avg</span>
                    </p>

                    <p className="hidden items-center gap-1.5 text-[11px] font-medium text-admin-muted sm:flex">
                      <span className="sr-only">Rank</span>
                      <span className="tabular-nums">Rank {rank}</span>
                    </p>
                  </div>
                </ListRow>
              );
            })
          )}
        </RecordList>
      )}

      <RecordSheet
        open={sheet.open}
        onClose={sheet.close}
        mode={sheet.mode}
        title={selected?.team_name ?? "Team"}
        formId="team-form"
        isPending={sheet.isPending}
        confirmUI={sheet.ConfirmDialogUI}
        status={
          selected && (
            <StatusPill
              tone={selected.wins > 0 ? "success" : "neutral"}
              icon={selected.wins > 0 ? <Medal className="h-3 w-3" /> : undefined}
              showLabelOnMobile
            >
              {selected.wins > 0
                ? `${selected.wins} ${selected.wins === 1 ? "win" : "wins"}`
                : "No wins yet"}
            </StatusPill>
          )
        }
      >
        {selected && (
          <div className="animate-in space-y-4 duration-200 fade-in sm:space-y-5">
            <DetailCard>
              <DetailCell
                label="Team"
                value={selected.team_name}
                icon={<Users className="h-3.5 w-3.5" />}
              />
              <DetailCell
                label="Rank"
                value={`#${rankOf.get(selected.team_name) ?? "-"}`}
                icon={<Trophy className="h-3.5 w-3.5" />}
              />
              <DetailCell
                label="Quizzes attended"
                value={selected.quizzes_attended}
                icon={<Hash className="h-3.5 w-3.5" />}
              />
              <DetailCell
                label="Total score"
                value={`${selected.total_score} pts`}
                icon={<Target className="h-3.5 w-3.5" />}
              />
              <DetailCell label="Average score" value={averageScore(selected)} />
              <DetailCell
                label="Wins"
                value={selected.wins}
                icon={<Medal className="h-3.5 w-3.5" />}
              />
            </DetailCard>

            <div className="space-y-2.5">
              <p className="px-1 text-[11px] font-semibold tracking-wide text-admin-primary">
                Event history ({sortedHistory.length})
              </p>

              {sortedHistory.length === 0 ? (
                <DetailCard>
                  <p className="px-4 py-6 text-center text-[12px] text-admin-muted sm:px-5">
                    No events recorded for this team yet.
                  </p>
                </DetailCard>
              ) : (
                sortedHistory.map((record) => {
                  const event = eventOf(record);
                  return (
                    <DetailCard key={record.id}>
                      <div className="flex items-start justify-between gap-3 border-b border-admin-line px-4 py-2.5 sm:px-5 sm:py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-admin-ink">
                            {event?.title || "Unnamed event"}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-admin-muted">
                            <Calendar className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
                            <span className="tabular-nums">{formatEventDate(event?.date)}</span>
                          </p>
                        </div>
                        <StatusPill
                          tone={record.is_winner ? "success" : "neutral"}
                          icon={record.is_winner ? <Trophy className="h-3 w-3" /> : undefined}
                          showLabelOnMobile
                        >
                          {record.is_winner ? "Winner" : "Participant"}
                        </StatusPill>
                      </div>
                      <DetailCell label="Score" value={`${record.score || 0} pts`} dense />
                    </DetailCard>
                  );
                })
              )}
            </div>
          </div>
        )}
      </RecordSheet>
    </div>
  );
}
