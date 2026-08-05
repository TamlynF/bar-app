"use client";

import { useState, useMemo } from "react";
import {
  Trophy,
  Medal,
  Target,
  Users,
  Calendar,
  Hash,
  SearchX,
  Mail,
  User,
} from "lucide-react";
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

type Related<T> = T | T[] | null;

export type RawQuizBooking = {
  id: number;
  group_name: string | null;
  contact_id: number | null;
  status: string | null;
  created_at: string;
  contacts: Related<{ id: number; full_name: string | null; email: string | null }>;
  events: Related<{ id: number; title: string | null; date: string | null }>;
  booking_scores: Related<{ id: number; score: number | null; is_winner: boolean | null }>;
};

export type TeamBooking = {
  bookingId: number;
  eventTitle: string;
  eventDate: string | null;
  status: string;
  score: number | null;
  isWinner: boolean;
};

export type TeamStats = {
  key: string;
  team_name: string;
  contact_id: number | null;
  contact_name: string | null;
  contact_email: string | null;
  quizzes_attended: number;
  total_score: number;
  wins: number;
  history: TeamBooking[];
};

// Supabase joins come back as an array or an object depending on the query.
function one<T>(value: Related<T>): T | undefined {
  return (Array.isArray(value) ? value[0] : value) ?? undefined;
}

function many<T>(value: Related<T>): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
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

function statusTone(status: string): "success" | "warning" | "error" | "neutral" {
  if (status === "confirmed") return "success";
  if (status === "waitlisted" || status === "pending") return "warning";
  if (status === "cancelled") return "error";
  return "neutral";
}

function toTitleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

export default function TeamsClient({
  initialBookings = [],
}: {
  initialBookings: RawQuizBooking[];
}) {
  const [query, setQuery] = useState("");

  // One team is one group name booking under one contact - the same name booked
  // by two different people is two different teams.
  const teamLeaderboard = useMemo(() => {
    const statsMap = new Map<string, TeamStats>();

    initialBookings.forEach((booking) => {
      const contact = one(booking.contacts);
      const event = one(booking.events);
      const scores = many(booking.booking_scores);

      const teamName =
        booking.group_name?.trim() || contact?.full_name?.trim() || "Unknown team";
      const key = `${booking.contact_id ?? "none"}::${teamName.toLowerCase()}`;

      let team = statsMap.get(key);
      if (!team) {
        team = {
          key,
          team_name: teamName,
          contact_id: booking.contact_id,
          contact_name: contact?.full_name?.trim() || null,
          contact_email: contact?.email?.trim() || null,
          quizzes_attended: 0,
          total_score: 0,
          wins: 0,
          history: [],
        };
        statsMap.set(key, team);
      }

      const status = booking.status?.trim().toLowerCase() || "confirmed";
      const score = scores.reduce<number | null>(
        (sum, row) => (row.score == null ? sum : (sum ?? 0) + row.score),
        null,
      );
      const isWinner = scores.some((row) => row.is_winner);

      // A cancelled booking is not a quiz they turned up to, so it stays in the
      // history without counting towards the totals.
      if (status !== "cancelled") {
        team.quizzes_attended += 1;
        team.total_score += score ?? 0;
        if (isWinner) team.wins += 1;
      }

      team.history.push({
        bookingId: booking.id,
        eventTitle: event?.title?.trim() || "Unnamed event",
        eventDate: event?.date ?? null,
        status,
        score,
        isWinner,
      });
    });

    return [...statsMap.values()].sort((a, b) => {
      if (b.total_score !== a.total_score) return b.total_score - a.total_score;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.team_name.localeCompare(b.team_name);
    });
  }, [initialBookings]);

  const sheet = useRecordSheet<TeamStats>({
    records: teamLeaderboard,
    getId: (record) => record.key,
  });
  const { selected } = sheet;

  // The rank a team is filtered into has to stay the rank it holds on the whole
  // board, so it is read before the search narrows anything.
  const rankOf = useMemo(() => {
    const ranks = new Map<string, number>();
    teamLeaderboard.forEach((team, index) => ranks.set(team.key, index + 1));
    return ranks;
  }, [teamLeaderboard]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return teamLeaderboard;
    return teamLeaderboard.filter((team) =>
      [team.team_name, team.contact_name, team.contact_email].some((field) =>
        field?.toLowerCase().includes(needle),
      ),
    );
  }, [teamLeaderboard, query]);

  const sortedHistory = useMemo(() => {
    if (!selected) return [];
    return [...selected.history].sort((a, b) =>
      (b.eventDate ?? "").localeCompare(a.eventDate ?? ""),
    );
  }, [selected]);

  return (
    <div className="mx-auto w-full space-y-3 px-2 py-3 sm:space-y-4 sm:px-4 sm:py-0 md:px-6">
      {teamLeaderboard.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No quiz teams yet"
          description="Teams appear here once a quiz event has been booked"
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
              placeholder="Search by team, customer or email"
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
              const rank = rankOf.get(team.key) ?? 0;
              const leading = rank === 1;
              return (
                <ListRow
                  key={team.key}
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
                  <div className="min-w-0 flex-1 sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_14rem_9rem] sm:items-center sm:gap-3">
                    <p className="min-w-0 truncate text-sm leading-snug font-semibold text-admin-ink">
                      {team.team_name}
                    </p>

                    <p className="mt-0.5 min-w-0 truncate text-[11px] font-medium text-admin-muted sm:mt-0 sm:text-[12px]">
                      {team.contact_name || team.contact_email || "No customer on record"}
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
                label="Booked by"
                value={selected.contact_name || "-"}
                icon={<User className="h-3.5 w-3.5" />}
              />
              <DetailCell
                label="Email"
                value={
                  selected.contact_email ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="break-all">{selected.contact_email}</span>
                      <a
                        href={`mailto:${selected.contact_email}`}
                        aria-label={`Email ${selected.contact_name ?? selected.team_name}`}
                        title={`Email ${selected.contact_email}`}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-admin-muted transition-colors hover:bg-admin-primary-soft hover:text-admin-primary"
                      >
                        <Mail className="h-3.5 w-3.5" />
                      </a>
                    </span>
                  ) : (
                    "-"
                  )
                }
              />
              <DetailCell
                label="Rank"
                value={`#${rankOf.get(selected.key) ?? "-"}`}
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
                Quiz history ({sortedHistory.length})
              </p>

              {sortedHistory.map((entry) => (
                <DetailCard key={entry.bookingId}>
                  <div className="flex items-start justify-between gap-3 border-b border-admin-line px-4 py-2.5 sm:px-5 sm:py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-admin-ink">
                        {entry.eventTitle}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-admin-muted">
                        <Calendar className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
                        <span className="tabular-nums">{formatEventDate(entry.eventDate)}</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <StatusPill tone={statusTone(entry.status)} showLabelOnMobile>
                        {toTitleCase(entry.status)}
                      </StatusPill>
                      {entry.isWinner && (
                        <StatusPill
                          tone="success"
                          icon={<Trophy className="h-3 w-3" />}
                          showLabelOnMobile
                        >
                          Winner
                        </StatusPill>
                      )}
                    </div>
                  </div>
                  <DetailCell
                    label="Score"
                    value={entry.score == null ? "Not scored" : `${entry.score} pts`}
                    dense
                  />
                </DetailCard>
              ))}
            </div>
          </div>
        )}
      </RecordSheet>
    </div>
  );
}
