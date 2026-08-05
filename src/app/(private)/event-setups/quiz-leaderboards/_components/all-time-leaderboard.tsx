"use client";

import React, { useMemo, useState } from "react";
import { Trophy, Medal, Award, Crown, Target, SearchX } from "lucide-react";
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
import type { AllTimeTeam } from "../actions";

type RankedTeam = AllTimeTeam & { rank: number };

// The same podium tints the event standings on this page use, so the two lists
// agree on what first, second and third look like.
const PODIUM: Record<
  number,
  { chip: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  1: { chip: "border-[#D4AF37]/40 bg-[#FBF1CD] text-[#8A6D00]", Icon: Crown },
  2: { chip: "border-slate-300 bg-slate-100 text-slate-600", Icon: Medal },
  3: { chip: "border-[#C8956D]/40 bg-[#F3E2D3] text-[#8A5A30]", Icon: Award },
};

const fmtScore = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function averageScore(team: AllTimeTeam): string {
  if (!team.quizzes_attended) return "-";
  return fmtScore(team.total_score / team.quizzes_attended);
}

function quizzesLabel(count: number): string {
  return `${count} ${count === 1 ? "quiz" : "quizzes"}`;
}

function winsLabel(count: number): string {
  return `${count} ${count === 1 ? "win" : "wins"}`;
}

export default function AllTimeLeaderboard({ entries }: { entries: AllTimeTeam[] }) {
  // Rank comes from the full standings, so filtering the list never renumbers
  // the teams left in it.
  const ranked: RankedTeam[] = useMemo(
    () => entries.map((entry, index) => ({ ...entry, rank: index + 1 })),
    [entries],
  );

  const sheet = useRecordSheet<RankedTeam>({
    records: ranked,
    getId: (record) => record.team_name,
  });
  const { selected } = sheet;
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return ranked;
    return ranked.filter((team) => team.team_name.toLowerCase().includes(needle));
  }, [ranked, query]);

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={Target}
        title="No quiz scores yet"
        description="Team scores will appear here after quiz events."
      />
    );
  }

  return (
    <>
      <RecordList
        variant="panel"
        title="All-time standings"
        count={shown.length}
        toolbar={
          <ListSearchInput
            value={query}
            onChange={setQuery}
            label="Search all-time standings"
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
            const podium = PODIUM[team.rank];
            return (
              <ListRow
                key={team.team_name}
                onClick={() => sheet.openView(team)}
                status={
                  <StatusPill tone="neutral" className="sm:w-24 sm:justify-center">
                    <span className="tabular-nums">{fmtScore(team.total_score)}</span> pts
                  </StatusPill>
                }
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold tabular-nums",
                    podium
                      ? podium.chip
                      : "border-admin-line bg-admin-surface text-admin-muted",
                  )}
                  title={`Rank ${team.rank}`}
                >
                  {podium ? <podium.Icon className="h-4 w-4" /> : team.rank}
                </span>

                {/* Fixed tracks rather than content-sized ones, so the quiz count
                    of every row starts in the same place. */}
                <div className="min-w-0 flex-1 sm:grid sm:grid-cols-[minmax(0,1fr)_8rem_8rem] sm:items-center sm:gap-3">
                  <p className="min-w-0 truncate text-sm leading-snug font-semibold text-admin-ink">
                    {team.team_name}
                  </p>

                  <p className="mt-0.5 truncate text-[11px] font-medium text-admin-muted sm:mt-0 sm:text-[12px]">
                    {quizzesLabel(team.quizzes_attended)}
                  </p>

                  <div className="hidden items-center sm:flex">
                    {team.wins > 0 ? (
                      <InfoBadge icon={<Trophy className="h-3 w-3" />}>
                        {winsLabel(team.wins)}
                      </InfoBadge>
                    ) : (
                      <span className="text-[11px] font-medium text-admin-muted opacity-60">
                        No wins
                      </span>
                    )}
                  </div>
                </div>
              </ListRow>
            );
          })
        )}
      </RecordList>

      <RecordSheet
        open={sheet.open}
        onClose={sheet.close}
        mode={sheet.mode}
        title={selected?.team_name ?? "Team"}
        formId="all-time-team"
        isPending={sheet.isPending}
        confirmUI={sheet.ConfirmDialogUI}
        status={
          selected && (
            <StatusPill tone="neutral" showLabelOnMobile>
              Rank {selected.rank} of {ranked.length}
            </StatusPill>
          )
        }
      >
        {selected && (
          <div className="animate-in space-y-4 duration-200 fade-in sm:space-y-5">
            <DetailCard>
              <DetailCell dense label="Team" value={selected.team_name} />
              <DetailCell dense label="Rank" value={`${selected.rank} of ${ranked.length}`} />
              <DetailCell dense label="Wins" value={winsLabel(selected.wins)} />
              <DetailCell
                dense
                label="Quizzes"
                value={quizzesLabel(selected.quizzes_attended)}
              />
              <DetailCell
                dense
                label="Total score"
                value={`${fmtScore(selected.total_score)} pts`}
              />
              <DetailCell
                dense
                label="Average"
                value={`${averageScore(selected)} pts per quiz`}
              />
            </DetailCard>
          </div>
        )}
      </RecordSheet>
    </>
  );
}
