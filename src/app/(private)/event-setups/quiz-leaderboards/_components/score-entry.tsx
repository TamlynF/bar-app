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

const parseDate = (d: string) => new Date(d + "T00:00:00");

const toDraft = (t: TeamRow): Draft => ({ ...t, scoreInput: t.score != null ? String(t.score) : "" });

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
    if (value !== "" && !/^\d*\.?\d*$/.test(value)) return;
    setRows((prev) => prev.map((r) => (r.bookingId === bookingId ? { ...r, scoreInput: value } : r)));
  };

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
        className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-[#B45309] px-4 font-black text-[11px] tracking-widest text-white uppercase transition-colors hover:bg-[#B45309]/85 disabled:pointer-events-none disabled:opacity-40"
      >
        <ClipboardList className="h-4 w-4" /> Edit Scores
      </button>

      <Sheet open={open} onOpenChange={(o) => { if (!o) setOpen(false); }}>
        <SheetContent
          side="bottom"
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="flex h-[88vh] flex-col rounded-t-[2.5rem] border-t-2 border-[#E6DFC8] bg-[#F7F4EA] p-0 shadow-2xl outline-none"
        >
          <div className="shrink-0 space-y-3 border-b border-[#E6DFC8] bg-white/90 px-5 pt-5 pb-4 backdrop-blur-md sm:px-6">
            <div>
              <p className="font-black text-[10px] tracking-[0.18em] text-[#5F624F] uppercase">Edit Scores</p>
              <SheetTitle className="mt-0.5 font-black text-xl leading-tight tracking-tight text-[#1F1F1A] uppercase sm:text-2xl">
                Select an event
              </SheetTitle>
            </div>
            <div className="relative w-full">
              <CalendarDays className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#5C4033]" />
              <select
                aria-label="Select quiz event"
                value={eventId}
                onChange={(e) => onSelectEvent(e.target.value)}
                className="h-11 w-full appearance-none rounded-xl border border-[#E6DFC8] bg-white pr-9 pl-10 text-sm font-bold text-[#1F1F1A] transition-colors outline-none focus:border-[#5C4033]"
              >
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {format(parseDate(e.date), "dd MMM yyyy")}{e.title ? ` - ${e.title}` : ""}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-[#5F624F]" />
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto bg-[#F7F4EA] px-5 py-4 sm:px-6">
            {isLoadingTeams ? (
              <div className="flex items-center justify-center gap-2 py-10 text-[#5F624F]">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm font-bold">Loading teams…</span>
              </div>
            ) : rows.length === 0 ? (
              <p className="py-10 text-center text-sm text-[#5F624F]">No teams booked on this event.</p>
            ) : (
              rows.map((r) => (
                <div key={r.bookingId} className="flex items-center gap-3 rounded-2xl border border-[#E6DFC8] bg-white p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-black text-sm tracking-tight text-[#1F1F1A] uppercase">{r.groupName}</p>
                    <div className="mt-0.5 flex items-center gap-2 text-[#5F624F]">
                      {r.contactName && <span className="truncate text-xs font-semibold">{r.contactName}</span>}
                      {r.groupSize != null && (
                        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold">
                          <Users className="h-3 w-3 opacity-60" />
                          {r.groupSize}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleWinner(r.bookingId)}
                    aria-label={r.isWinner ? "Unmark winner" : "Mark as winner"}
                    aria-pressed={r.isWinner}
                    title="Winner"
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors",
                      r.isWinner
                        ? "border-[#D4AF37]/50 bg-[#FBF1CD] text-[#8A6D00]"
                        : "border-[#E6DFC8] bg-[#F7F4EA] text-[#5F624F]/50 hover:text-[#8A6D00]",
                    )}
                  >
                    <Trophy className={cn("h-4 w-4", r.isWinner && "fill-current")} />
                  </button>

                  <div className="w-20 shrink-0">
                    <label htmlFor={`score-${r.bookingId}`} className="sr-only">
                      Score for {r.groupName}
                    </label>
                    <input
                      id={`score-${r.bookingId}`}
                      inputMode="decimal"
                      value={r.scoreInput}
                      onChange={(e) => setScore(r.bookingId, e.target.value)}
                      placeholder="-"
                      className="h-11 w-full rounded-xl border border-[#E6DFC8] bg-white px-3 text-center font-black text-base text-[#1F1F1A] tabular-nums transition-colors outline-none placeholder:text-[#5F624F]/30 focus:border-[#5C4033]"
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="grid shrink-0 grid-cols-[auto_1fr] gap-3 border-t border-[#E6DFC8] bg-white/90 px-5 py-4 backdrop-blur-md sm:px-6">
            <Button
              variant="secondary"
              onClick={() => setOpen(false)}
              className="h-12 rounded-xl px-5 font-black text-[11px] tracking-wide uppercase"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isPending || isLoadingTeams || rows.length === 0}
              className="h-12 rounded-xl bg-[#1B4332] font-black text-xs tracking-widest text-white uppercase hover:bg-[#1B4332]/85"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><Save className="mr-2 h-4 w-4" /> Save Scores</>)}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
