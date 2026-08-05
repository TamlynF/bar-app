"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trophy, Users, SearchX, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  RecordList,
  ListSearchInput,
  InfoBadge,
  EmptyState,
} from "@/components/admin";
import { setEventWinner, type TeamRow } from "../actions";

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function EventTeams({
  eventId,
  teams,
}: {
  eventId: string;
  teams: TeamRow[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  // The winner is whatever the last server render said. Holding it in plain state
  // instead would leave this list showing a winner the standings below disagree
  // with, since only the server knows what was actually written.
  const recordedWinnerId = useMemo(
    () => teams.find((team) => team.isWinner)?.bookingId ?? null,
    [teams],
  );
  const [winnerId, showWinner] = useOptimistic(recordedWinnerId);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return teams;
    return teams.filter((team) =>
      [team.groupName, team.contactName ?? ""].some((field) =>
        field.toLowerCase().includes(needle),
      ),
    );
  }, [teams, query]);

  // Clicking the team that already won clears the result, so a mistake is undone
  // the same way it was made.
  const choose = (bookingId: string) => {
    const next = winnerId === bookingId ? null : bookingId;

    startTransition(async () => {
      showWinner(next);
      const result = await setEventWinner(eventId, next);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(next ? "Winner saved" : "Winner cleared");
      // Pulls the standings and the header count below back in step with the
      // result that was just written.
      router.refresh();
    });
  };

  if (teams.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No confirmed teams"
        description="No confirmed teams are booked on this quiz event yet."
      />
    );
  }

  return (
    <RecordList
      variant="panel"
      title="Teams on this quiz"
      count={shown.length}
      toolbar={
        <ListSearchInput
          value={query}
          onChange={setQuery}
          label="Search teams on this quiz"
          placeholder="Search by team or customer"
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
          const won = winnerId === team.bookingId;
          return (
            <div
              key={team.bookingId}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 transition-colors sm:px-4",
                won && "bg-admin-primary-soft/40",
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                  won
                    ? "border-admin-gold/40 bg-admin-gold/10 text-admin-gold"
                    : "border-admin-line bg-admin-surface text-admin-muted",
                )}
              >
                {won ? (
                  <Trophy className="h-4 w-4 fill-current" aria-hidden="true" />
                ) : (
                  initialsOf(team.groupName)
                )}
              </span>

              {/* Fixed tracks rather than content-sized ones, so the customer of
                  every row starts in the same place. */}
              <div className="min-w-0 flex-1 sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7rem] sm:items-center sm:gap-3">
                <p className="min-w-0 truncate text-sm leading-snug font-semibold text-admin-ink">
                  {team.groupName}
                </p>

                <p className="mt-0.5 min-w-0 truncate text-[11px] font-medium text-admin-muted sm:mt-0 sm:text-[12px]">
                  {team.contactName || "No customer on record"}
                </p>

                <div className="hidden items-center sm:flex">
                  {team.groupSize != null ? (
                    <InfoBadge icon={<Users className="h-3 w-3" />}>
                      {team.groupSize}
                    </InfoBadge>
                  ) : (
                    <span className="text-[11px] font-medium text-admin-muted opacity-60">
                      No size
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => choose(team.bookingId)}
                disabled={isPending}
                aria-pressed={won}
                aria-label={won ? `Clear ${team.groupName} as winner` : `Mark ${team.groupName} as the winner`}
                title={won ? "Clear the winner" : "Mark as the winner"}
                // Fixed width, so "Winner" and "Set winner" cannot size their own
                // rows differently and knock the columns beside them out of line.
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border px-3 text-[13px] font-semibold transition-colors disabled:opacity-50 sm:h-9 sm:w-32",
                  won
                    ? "border-admin-gold/50 bg-admin-gold/10 text-admin-gold"
                    : "border-admin-line bg-admin-card text-admin-muted hover:border-admin-primary/40 hover:bg-admin-primary-soft hover:text-admin-primary",
                )}
              >
                {isPending && won ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <Trophy className={cn("h-4 w-4 shrink-0", won && "fill-current")} />
                )}
                <span className="hidden sm:inline">{won ? "Winner" : "Set winner"}</span>
              </button>
            </div>
          );
        })
      )}
    </RecordList>
  );
}
