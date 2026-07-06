export const dynamic = "force-dynamic";

import React from "react";
import { Trophy, Medal, Award, Crown, Users, ListOrdered } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { getQuizEvents, getEventTeams, type TeamRow } from "./actions";
import LeaderboardEventFilter from "./_components/leaderboard-event-filter";
import ScoreEntry from "./_components/score-entry";

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
    <div className="rounded-2xl border border-dashed border-[#E6DFC8] bg-white/40 py-16 text-center flex flex-col items-center">
      <div className="w-14 h-14 rounded-2xl bg-[#F7F4EA] flex items-center justify-center mb-4">
        <Trophy className="w-6 h-6 text-[#5F624F] opacity-40" />
      </div>
      <p className="text-sm font-black uppercase tracking-tight text-[#1F1F1A]">{title}</p>
      <p className="text-xs text-[#5F624F] mt-1.5 max-w-xs leading-relaxed">{hint}</p>
    </div>
  );
}

function StandingCard({ row, rank }: { row: TeamRow; rank: number }) {
  const podium = PODIUM[rank];
  return (
    <div
      className={cn(
        "rounded-2xl bg-white flex items-center gap-3 p-3 shadow-sm",
        podium ? cn("border-2", podium.ring) : "border border-[#E6DFC8]",
      )}
    >
      <div className={cn("w-1 self-stretch rounded-full shrink-0", podium ? podium.bar : "bg-[#E6DFC8]")} />
      <div
        className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black tabular-nums",
          podium ? podium.chip : "bg-[#F7F4EA] text-[#5F624F]",
        )}
      >
        {podium ? <podium.Icon className="w-5 h-5" /> : rank}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <h3 className="text-sm font-black uppercase tracking-tight truncate text-[#1F1F1A]">{row.groupName}</h3>
          {row.isWinner && (
            <span className="inline-flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wide bg-[#FBF1CD] text-[#8A6D00]">
              <Trophy className="w-3 h-3" /> Winner
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 text-[#5F624F]">
          {row.contactName && <span className="text-xs font-semibold truncate">{row.contactName}</span>}
          {row.groupSize != null && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold shrink-0">
              <Users className="w-3 h-3 opacity-60" />
              {row.groupSize}
            </span>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-lg font-black tabular-nums leading-none text-[#1F1F1A]">{fmtScore(row.score ?? 0)}</p>
        <p className="text-[9px] font-black uppercase tracking-widest text-[#5F624F]/70 mt-1">pts</p>
      </div>
    </div>
  );
}

function UnscoredRow({ row }: { row: TeamRow }) {
  return (
    <div className="rounded-2xl bg-white/60 border border-dashed border-[#E6DFC8] flex items-center gap-3 p-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-[#F7F4EA] text-[#5F624F]/40 font-black">–</div>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-black uppercase tracking-tight truncate text-[#1F1F1A]/70">{row.groupName}</h3>
        {row.contactName && <p className="text-xs font-semibold truncate text-[#5F624F]/70">{row.contactName}</p>}
      </div>
      <span className="text-[10px] font-black uppercase tracking-wide text-[#5F624F]/50 shrink-0">Not scored</span>
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
      <div className="max-w-4xl mx-auto px-2 py-2 sm:px-4 md:px-6 sm:py-0">
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
  const teams = await getEventTeams(selectedEventId);

  const scored = teams.filter((t) => t.score != null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const unscored = teams.filter((t) => t.score == null);

  // Standard competition ranking — equal scores share a rank.
  const ranked = scored.map((row) => ({
    row,
    rank: scored.findIndex((r) => r.score === row.score) + 1,
  }));

  const totalGuests = teams.reduce((sum, t) => sum + (t.groupSize ?? 0), 0);

  return (
    <div className="max-w-4xl mx-auto px-2 py-2 sm:px-4 md:px-6 sm:py-0 space-y-4">
      {/* Controls + event summary */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F624F]">Leaderboard</p>
          <h2 className="text-xl font-black uppercase tracking-tighter text-[#1F1F1A] leading-none mt-1">{eventLabel}</h2>
        </div>
        <div className="flex items-center gap-2">
          <LeaderboardEventFilter events={events} selectedEventId={selectedEventId} />
          <ScoreEntry eventId={selectedEventId} eventLabel={eventLabel} teams={teams} />
        </div>
      </div>

      {/* Quick stats */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg bg-white border border-[#E6DFC8] text-[11px] font-black uppercase tracking-wide text-[#5F624F]">
          <ListOrdered className="w-3.5 h-3.5" /> {teams.length} teams
        </span>
        {totalGuests > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg bg-white border border-[#E6DFC8] text-[11px] font-black uppercase tracking-wide text-[#5F624F]">
            <Users className="w-3.5 h-3.5" /> {totalGuests} guests
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
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F624F]/70 px-0.5 pt-2">
            Not yet scored ({unscored.length})
          </p>
          {unscored.map((row) => (
            <UnscoredRow key={row.bookingId} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}
