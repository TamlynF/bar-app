export const dynamic = "force-dynamic";

import React from "react";
import { Trophy, Medal, Award, Crown, Users, ListOrdered } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { getQuizEvents, getEventTeams, getAllTimeLeaderboard, type TeamRow } from "./actions";
import LeaderboardEventFilter from "./_components/leaderboard-event-filter";
import ScoreEntry from "./_components/score-entry";
import AllTimeLeaderboard from "./_components/all-time-leaderboard";

const parseDate = (d: string) => new Date(d + "T00:00:00");

// Podium identity for the top three ranks; everything else is neutral espresso.
const PODIUM: Record<number, { ring: string; chip: string; bar: string; Icon: React.ComponentType<{ className?: string }> }> = {
  1: { ring: "border-[#D4AF37]/60", chip: "bg-[#FBF1CD] text-[#8A6D00]", bar: "bg-[#D4AF37]", Icon: Crown },
  2: { ring: "border-slate-300", chip: "bg-slate-100 text-slate-600", bar: "bg-slate-400", Icon: Medal },
  3: { ring: "border-[#C8956D]/60", chip: "bg-[#F3E2D3] text-[#8A5A30]", bar: "bg-[#C8956D]", Icon: Award },
};

const fmtScore = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-[#E6DFC8] bg-white/40 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F7F4EA]">
        <Trophy className="h-6 w-6 text-[#5F624F] opacity-40" />
      </div>
      <p className="font-black text-sm tracking-tight text-[#1F1F1A] uppercase">{title}</p>
      <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-[#5F624F]">{hint}</p>
    </div>
  );
}

function StandingCard({ row, rank }: { row: TeamRow; rank: number }) {
  const podium = PODIUM[rank];
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm",
        podium ? cn("border-2", podium.ring) : "border border-[#E6DFC8]",
      )}
    >
      <div className={cn("w-1 shrink-0 self-stretch rounded-full", podium ? podium.bar : "bg-[#E6DFC8]")} />
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-black tabular-nums",
          podium ? podium.chip : "bg-[#F7F4EA] text-[#5F624F]",
        )}
      >
        {podium ? <podium.Icon className="h-5 w-5" /> : rank}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <h3 className="truncate font-black text-sm tracking-tight text-[#1F1F1A] uppercase">{row.groupName}</h3>
          {row.isWinner && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[#FBF1CD] px-1.5 py-0.5 font-black text-[9px] tracking-wide text-[#8A6D00] uppercase">
              <Trophy className="h-3 w-3" /> Winner
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2 text-[#5F624F]">
          {row.contactName && <span className="truncate text-xs font-semibold">{row.contactName}</span>}
          {row.groupSize != null && (
            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold">
              <Users className="h-3 w-3 opacity-60" />
              {row.groupSize}
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-black text-lg leading-none text-[#1F1F1A] tabular-nums">{fmtScore(row.score ?? 0)}</p>
        <p className="mt-1 font-black text-[9px] tracking-widest text-[#5F624F]/70 uppercase">pts</p>
      </div>
    </div>
  );
}

function UnscoredRow({ row }: { row: TeamRow }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-[#E6DFC8] bg-white/60 p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F7F4EA] font-black text-[#5F624F]/40">–</div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-black text-sm tracking-tight text-[#1F1F1A]/70 uppercase">{row.groupName}</h3>
        {row.contactName && <p className="truncate text-xs font-semibold text-[#5F624F]/70">{row.contactName}</p>}
      </div>
      <span className="shrink-0 font-black text-[10px] tracking-wide text-[#5F624F]/50 uppercase">Not scored</span>
    </div>
  );
}

export default async function QuizLeaderboardsPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const { event } = await searchParams;
  const events = await getQuizEvents();

  if (events.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-2 py-2 sm:px-4 sm:py-0 md:px-6">
        <EmptyState
          title="No quiz events yet"
          hint="Quiz events with at least one booked team will appear here, where you can record scores and see the standings."
        />
      </div>
    );
  }

  const selectedEventId = event && events.some((e) => e.id === event) ? event : events[0].id;
  const selectedEvent = events.find((e) => e.id === selectedEventId)!;
  const eventLabel = selectedEvent.title || format(parseDate(selectedEvent.date), "dd MMM yyyy");
  const [teams, allTimeTeams] = await Promise.all([
    getEventTeams(selectedEventId),
    getAllTimeLeaderboard(10),
  ]);

  const scored = teams.filter((t) => t.score != null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const unscored = teams.filter((t) => t.score == null);

  // Standard competition ranking — equal scores share a rank.
  const ranked = scored.map((row) => ({
    row,
    rank: scored.findIndex((r) => r.score === row.score) + 1,
  }));

  const totalGuests = teams.reduce((sum, t) => sum + (t.groupSize ?? 0), 0);

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-2 py-2 sm:px-4 sm:py-0 md:px-6">
      {/* Controls + event summary */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-black text-[10px] tracking-[0.2em] text-[#5F624F] uppercase">Leaderboard</p>
          <h2 className="mt-1 font-black text-xl leading-none tracking-tighter text-[#1F1F1A] uppercase">{eventLabel}</h2>
        </div>
        <div className="flex items-center gap-2">
          <LeaderboardEventFilter events={events} selectedEventId={selectedEventId} />
          <ScoreEntry events={events} initialEventId={selectedEventId} initialTeams={teams} />
        </div>
      </div>

      {/* Quick stats */}
      <div className="flex items-center gap-2">
        <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E6DFC8] bg-white px-3 font-black text-[11px] tracking-wide text-[#5F624F] uppercase">
          <ListOrdered className="h-3.5 w-3.5" /> {teams.length} teams
        </span>
        {totalGuests > 0 && (
          <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E6DFC8] bg-white px-3 font-black text-[11px] tracking-wide text-[#5F624F] uppercase">
            <Users className="h-3.5 w-3.5" /> {totalGuests} guests
          </span>
        )}
      </div>

      {/* Standings */}
      {teams.length === 0 ? (
        <EmptyState title="No teams booked" hint="No non-cancelled teams are booked on this quiz event yet." />
      ) : scored.length === 0 ? (
        <EmptyState title="No scores recorded yet" hint="Use “Enter Scores” to record each team’s result and build the standings." />
      ) : (
        <div className="space-y-2.5">
          {ranked.map(({ row, rank }) => (
            <StandingCard key={row.bookingId} row={row} rank={rank} />
          ))}
        </div>
      )}

      {/* Unscored teams (only once some are scored, to surface who still needs entering) */}
      {scored.length > 0 && unscored.length > 0 && (
        <div className="space-y-2.5">
          <p className="px-0.5 pt-2 font-black text-[10px] tracking-[0.2em] text-[#5F624F]/70 uppercase">
            Not yet scored ({unscored.length})
          </p>
          {unscored.map((row) => (
            <UnscoredRow key={row.bookingId} row={row} />
          ))}
        </div>
      )}

      {/* All-time standings across every quiz (moved here from the dashboard) */}
      <section className="space-y-2.5 pt-2">
        <div className="flex items-center gap-2 px-0.5">
          <Crown className="h-4 w-4 text-[#D4AF37]" />
          <p className="font-black text-[10px] tracking-[0.2em] text-[#5F624F] uppercase">All-Time Standings</p>
        </div>
        <AllTimeLeaderboard entries={allTimeTeams} />
      </section>
    </div>
  );
}
