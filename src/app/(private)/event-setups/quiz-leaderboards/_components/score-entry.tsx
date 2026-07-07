"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ClipboardList, Trophy, Save, Loader2, Users, CalendarDays, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getEventTeams, saveEventScores, type TeamRow, type LeaderboardEvent } from "../actions";

type Draft = TeamRow & { scoreInput: string };

// DB stores `date` as YYYY-MM-DD — anchor to local midnight (see CLAUDE.md).
const parseDate = (d: string) => new Date(d + "T00:00:00");
const eventLabelOf = (e: LeaderboardEvent) =>
  e.title || format(parseDate(e.date), "dd MMM yyyy");

const toDraft = (t: TeamRow): Draft => ({ ...t, scoreInput: t.score != null ? String(t.score) : "" });

/**
 * Self-contained "Edit Scores" sheet: pick the quiz event inside the sheet, then
 * set each team's score and mark a winner. Teams are (re)loaded whenever the
 * selected event changes.
 */
export default function ScoreEntry({
  events,
  initialEventId,
  initialTeams,
}: {
  events: LeaderboardEvent[];
  initialEventId: string;
  initialTeams: TeamRow[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isLoadingTeams, startLoading] = useTransition();
  const [eventId, setEventId] = useState(initialEventId);
  const [rows, setRows] = useState<Draft[]>(() => initialTeams.map(toDraft));

  const openSheet = () => {
    setEventId(initialEventId);
    setRows(initialTeams.map(toDraft)); // reset from the latest server data
    setOpen(true);
  };

  const onSelectEvent = (id: string) => {
    setEventId(id);
    startLoading(async () => {
      const teams = await getEventTeams(id);
      setRows(teams.map(toDraft));
    });
  };

  const setScore = (bookingId: string, value: string) => {
    // Allow digits and a single decimal point only.
    if (value !== "" && !/^\d*\.?\d*$/.test(value)) return;
    setRows((prev) => prev.map((r) => (r.bookingId === bookingId ? { ...r, scoreInput: value } : r)));
  };

  // Single winner — selecting one clears the others.
  const toggleWinner = (bookingId: string) => {
    setRows((prev) =>
      prev.map((r) => ({ ...r, isWinner: r.bookingId === bookingId ? !r.isWinner : false })),
    );
  };

  const handleSave = () => {
    const entries = rows.map((r) => {
      const trimmed = r.scoreInput.trim();
      const score = trimmed === "" ? null : Number(trimmed);
      return { bookingId: r.bookingId, score: Number.isNaN(score as number) ? null : score, isWinner: r.isWinner };
    });

    startTransition(async () => {
      const res = await saveEventScores(eventId, entries);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Scores saved");
        setOpen(false);
        // Navigate the standings to the event just scored so the change is visible.
        router.push(`/event-setups/quiz-leaderboards?event=${encodeURIComponent(eventId)}`);
        router.refresh();
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        disabled={events.length === 0}
        className="shrink-0 inline-flex items-center gap-1.5 h-11 px-4 rounded-xl bg-[#B45309] text-white hover:bg-[#B45309]/85 transition-colors text-[11px] font-black uppercase tracking-widest disabled:opacity-40 disabled:pointer-events-none"
      >
        <ClipboardList className="w-4 h-4" /> Edit Scores
      </button>

      <Sheet open={open} onOpenChange={(o) => { if (!o) setOpen(false); }}>
        <SheetContent
          side="bottom"
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="bg-[#F7F4EA] border-t-2 border-[#E6DFC8] rounded-t-[2.5rem] p-0 h-[88vh] flex flex-col outline-none shadow-2xl"
        >
          {/* Header + event picker */}
          <div className="shrink-0 px-5 sm:px-6 pt-5 pb-4 bg-white/90 backdrop-blur-md border-b border-[#E6DFC8] space-y-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F624F]">Edit Scores</p>
              <SheetTitle className="text-xl sm:text-2xl font-black uppercase tracking-tight leading-tight mt-0.5 text-[#1F1F1A]">
                Select an event
              </SheetTitle>
            </div>
            <div className="relative w-full">
              <CalendarDays className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5C4033] pointer-events-none" />
              <select
                aria-label="Select quiz event"
                value={eventId}
                onChange={(e) => onSelectEvent(e.target.value)}
                className="w-full h-11 rounded-xl bg-white border border-[#E6DFC8] pl-10 pr-9 text-sm font-bold text-[#1F1F1A] appearance-none outline-none focus:border-[#5C4033] transition-colors"
              >
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {format(parseDate(e.date), "dd MMM yyyy")}{e.title ? ` — ${e.title}` : ""}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5F624F] pointer-events-none" />
            </div>
          </div>

          {/* Team rows */}
          <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 bg-[#F7F4EA] min-h-0 space-y-2.5">
            {isLoadingTeams ? (
              <div className="flex items-center justify-center gap-2 py-10 text-[#5F624F]">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm font-bold">Loading teams…</span>
              </div>
            ) : rows.length === 0 ? (
              <p className="text-sm text-[#5F624F] text-center py-10">No teams booked on this event.</p>
            ) : (
              rows.map((r) => (
                <div key={r.bookingId} className="rounded-2xl bg-white border border-[#E6DFC8] p-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black uppercase tracking-tight truncate text-[#1F1F1A]">{r.groupName}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-[#5F624F]">
                      {r.contactName && <span className="text-xs font-semibold truncate">{r.contactName}</span>}
                      {r.groupSize != null && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold shrink-0">
                          <Users className="w-3 h-3 opacity-60" />
                          {r.groupSize}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Winner toggle */}
                  <button
                    type="button"
                    onClick={() => toggleWinner(r.bookingId)}
                    aria-label={r.isWinner ? "Unmark winner" : "Mark as winner"}
                    aria-pressed={r.isWinner}
                    title="Winner"
                    className={cn(
                      "shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors border",
                      r.isWinner
                        ? "bg-[#FBF1CD] text-[#8A6D00] border-[#D4AF37]/50"
                        : "bg-[#F7F4EA] text-[#5F624F]/50 border-[#E6DFC8] hover:text-[#8A6D00]",
                    )}
                  >
                    <Trophy className={cn("w-4 h-4", r.isWinner && "fill-current")} />
                  </button>

                  {/* Score input */}
                  <div className="shrink-0 w-20">
                    <label htmlFor={`score-${r.bookingId}`} className="sr-only">
                      Score for {r.groupName}
                    </label>
                    <input
                      id={`score-${r.bookingId}`}
                      inputMode="decimal"
                      value={r.scoreInput}
                      onChange={(e) => setScore(r.bookingId, e.target.value)}
                      placeholder="—"
                      className="w-full h-11 rounded-xl border border-[#E6DFC8] bg-white px-3 text-base font-black tabular-nums text-center text-[#1F1F1A] outline-none focus:border-[#5C4033] transition-colors placeholder:text-[#5F624F]/30"
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 px-5 sm:px-6 py-4 bg-white/90 backdrop-blur-md border-t border-[#E6DFC8] grid grid-cols-[auto_1fr] gap-3">
            <Button
              variant="secondary"
              onClick={() => setOpen(false)}
              className="h-12 rounded-xl font-black uppercase tracking-wide text-[11px] px-5"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isPending || isLoadingTeams || rows.length === 0}
              className="h-12 rounded-xl bg-[#1B4332] hover:bg-[#1B4332]/85 text-white font-black uppercase tracking-widest text-xs"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (<><Save className="w-4 h-4 mr-2" /> Save Scores</>)}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
