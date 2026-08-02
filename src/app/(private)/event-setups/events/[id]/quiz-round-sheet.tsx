"use client";

// src/app/(private)/event-setups/events/[id]/quiz-round-sheet.tsx
//
// Replaces the trip out to /event-setups/quiz-generator for standard question
// rounds. The round is built in place, in a sheet shaped like the band booking
// sheet:
//
//   sticky header  — round name, progress pill, stage rail, clear-drafts escape
//   scrolling body — drafts on the left, round setup on the right
//   sticky footer  — warnings docked to the action they block, then Approve
//
// What differs from the old generator, and why:
//
//   1. Event and category arrive as props. There are no dropdowns, so the two
//      cannot drift apart from the round you opened.
//   2. Generation over-produces (needed + DRAFT_BUFFER) and selection is capped
//      at exactly what the round needs. "Over limit" is now unreachable rather
//      than a red error you have to go and resolve.
//   3. Approving never empties the screen. The footer becomes the next round.
//
// Picture and music-snippet rounds are NOT handled here — they resolve images
// and Spotify track IDs and lock their topic. CategorySection keeps routing
// those to the full generator.

import React, { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Sparkles,
  Loader2,
  RefreshCw,
  Lock,
  CheckCircle2,
  Circle,
  AlertCircle,
  ArrowRight,
  Trash2,
} from "lucide-react";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import {
  generateQuizAction,
  saveQuizToDatabase,
  type QuizQuestion,
} from "@/app/(private)/event-setups/quiz-generator/actions";

import StageRail from "@/components/shared/stage-rail";
import {
  QUIZ_STAGES,
  QUIZ_STAGE_THEME,
  deriveRoundStage,
  nextRoundStage,
  generationCount,
  questionsNeeded,
  findDuplicateIndices,
  type QuizRoundStage,
} from "@/lib/quiz/round-stages";

const DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;
type Difficulty = (typeof DIFFICULTIES)[number];

export interface NextRoundSummary {
  categoryName: string;
  savedCount: number;
  targetCount: number;
}

type SavedQuestion = {
  id: string;
  question_text: string;
  answer_text: string;
  question_no?: number | null;
};

interface QuizRoundSheetProps {
  eventId: number;
  categoryConfigId: number;
  category_name: string;
  question_count: number;
  savedQuestions: SavedQuestion[];
  orderNo?: number;
  // Shown on the footer button once the round is filled.
  nextRound?: NextRoundSummary | null;
  // Fired after a successful approve, so the parent can refresh its list.
  onApproved?: () => void;
}

export default function QuizRoundSheet({
  eventId,
  categoryConfigId,
  category_name,
  question_count,
  savedQuestions,
  orderNo,
  nextRound = null,
  onApproved,
}: QuizRoundSheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("Medium");
  const [drafts, setDrafts] = useState<QuizQuestion[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const [isGenerating, setIsGenerating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [swappingIndex, setSwappingIndex] = useState<number | null>(null);
  const [justApproved, setJustApproved] = useState(false);

  const savedCount = savedQuestions.length;
  const needed = questionsNeeded(savedCount, question_count);
  const hasAny = savedCount > 0;
  const isComplete = question_count > 0 && savedCount >= question_count;

  const stage: QuizRoundStage = deriveRoundStage({
    savedCount,
    targetCount: question_count,
    draftCount: drafts.length,
  });

  const previousQuestionTexts = useMemo(
    () => savedQuestions.map((q) => q.question_text),
    [savedQuestions]
  );

  const duplicateIndices = useMemo(
    () => findDuplicateIndices(drafts, previousQuestionTexts),
    [drafts, previousQuestionTexts]
  );

  const selectedDuplicateCount = useMemo(
    () => [...selected].filter((i) => duplicateIndices.has(i)).length,
    [selected, duplicateIndices]
  );

  const selectionCap = needed > 0 ? needed : question_count;
  const atCap = selected.size >= selectionCap;

  const resetDrafts = useCallback(() => {
    setDrafts([]);
    setSelected(new Set());
  }, []);

  const handleGenerate = useCallback(async () => {
    if (isGenerating) return;
    setJustApproved(false);
    setIsGenerating(true);

    try {
      const result = await generateQuizAction(
        topic,
        category_name,
        generationCount(savedCount, question_count),
        difficulty,
        eventId,
        categoryConfigId
      );

      if (result.error || !result.questions?.length) {
        toast.error(result.error || "Nothing came back. Try again.");
        return;
      }

      setDrafts(result.questions);

      // Pre-tick exactly what the round needs, skipping anything that repeats a
      // question already saved. Unticking one dud beats ticking nine keepers.
      const dupes = findDuplicateIndices(result.questions, previousQuestionTexts);
      const cap = needed > 0 ? needed : question_count;
      const preselect = new Set<number>();
      for (let i = 0; i < result.questions.length; i++) {
        if (preselect.size >= cap) break;
        if (dupes.has(i)) continue;
        preselect.add(i);
      }
      setSelected(preselect);
    } catch {
      toast.error("Could not reach the generator.");
    } finally {
      setIsGenerating(false);
    }
  }, [
    isGenerating,
    topic,
    category_name,
    savedCount,
    question_count,
    difficulty,
    eventId,
    categoryConfigId,
    needed,
    previousQuestionTexts,
  ]);

  // Replace one draft rather than binning the batch.
  const handleSwap = useCallback(
    async (index: number) => {
      if (swappingIndex !== null) return;
      setSwappingIndex(index);

      try {
        const result = await generateQuizAction(
          topic,
          category_name,
          1,
          difficulty,
          eventId,
          categoryConfigId
        );

        const replacement = result.questions?.[0];
        if (result.error || !replacement) {
          toast.error(result.error || "No replacement came back.");
          return;
        }

        setDrafts((prev) => prev.map((q, i) => (i === index ? replacement : q)));
      } catch {
        toast.error("Could not swap that question.");
      } finally {
        setSwappingIndex(null);
      }
    },
    [swappingIndex, topic, category_name, difficulty, eventId, categoryConfigId]
  );

  const toggleDraft = useCallback(
    (index: number) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(index)) {
          next.delete(index);
          return next;
        }
        // Hard cap. A tick past the round size simply does not take — no error
        // state, no disabled Approve, nothing to go and resolve.
        if (next.size >= selectionCap) {
          toast.info(`That's ${selectionCap} already — untick one first.`);
          return prev;
        }
        next.add(index);
        return next;
      });
    },
    [selectionCap]
  );

  const handleApprove = useCallback(async () => {
    if (isApproving || selected.size === 0) return;
    setIsApproving(true);

    try {
      const chosen = [...selected]
        .sort((a, b) => a - b)
        .map((i) => drafts[i])
        .filter(Boolean)
        // saveQuizToDatabase resolves the config row by category name, so pin it
        // to this round rather than trusting whatever the model echoed back.
        .map((q) => ({ ...q, category: category_name }));

      await saveQuizToDatabase(chosen, eventId, topic);

      toast.success(
        chosen.length >= needed
          ? `${category_name} complete`
          : `${chosen.length} added to ${category_name}`
      );

      resetDrafts();
      setJustApproved(true);
      onApproved?.();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save those questions.");
    } finally {
      setIsApproving(false);
    }
  }, [
    isApproving,
    selected,
    drafts,
    category_name,
    eventId,
    topic,
    needed,
    resetDrafts,
    onApproved,
    router,
  ]);

  // Every footer state reads as a countdown to done, never as an error.
  const footerMessage = (() => {
    if (drafts.length > 0) {
      if (selected.size === 0) return "Nothing chosen yet";
      if (selected.size >= needed) return `${selected.size} chosen — completes the round`;
      return `${selected.size} chosen — ${needed - selected.size} still needed`;
    }
    if (justApproved && isComplete) return "Round complete";
    if (isComplete) return `${savedCount} of ${question_count} — round is full`;
    return `${needed} question${needed === 1 ? "" : "s"} still needed`;
  })();

  const warning =
    selectedDuplicateCount > 0
      ? `${selectedDuplicateCount} chosen question${
          selectedDuplicateCount === 1 ? " repeats one" : "s repeat ones"
        } already saved to this round — swap or untick`
      : null;

  return (
    <>
      {/* Trigger — same classes and labels as the Link it replaces */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-admin-primary px-3 text-[12px] font-semibold text-white transition-colors hover:bg-admin-primary-hover sm:px-4 sm:text-[13px]"
      >
        <Sparkles className="h-4 w-4" />
        <span className="sm:hidden">{hasAny ? `Add ${needed}` : "Start"}</span>
        <span className="hidden sm:inline">
          {hasAny ? `Add ${needed} question${needed === 1 ? "" : "s"}` : "Start round"}
        </span>
      </button>

      <Sheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            resetDrafts();
            setJustApproved(false);
          }
        }}
      >
        <SheetContent
          side="bottom"
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="flex h-[90vh] flex-col overflow-hidden rounded-t-3xl border-t border-admin-line bg-admin-bg p-0 outline-none
            sm:inset-x-auto sm:bottom-6 sm:left-1/2 sm:h-auto sm:max-h-[88vh] sm:w-[54rem]
            sm:max-w-[95vw] sm:-translate-x-1/2 sm:rounded-3xl sm:border"
        >
          {/* ---- Sticky header */}
          <div className="shrink-0 border-b border-admin-line bg-admin-surface px-4 pt-4 pb-3 sm:px-6">
            <div className="mb-3 flex items-baseline gap-3">
              <SheetTitle className="truncate text-[15px] font-bold tracking-tight text-admin-primary">
                {orderNo != null ? `${orderNo}. ` : ""}
                {category_name}
              </SheetTitle>
              <span className="flex-1" />
              <span
                className={cn(
                  "shrink-0 rounded-lg border px-2.5 py-1 text-[13px] font-semibold tabular-nums",
                  isComplete
                    ? "border-admin-success/25 bg-admin-success-bg text-admin-success"
                    : hasAny
                      ? "border-admin-warning/25 bg-admin-warning-bg text-admin-warning"
                      : "border-admin-line bg-admin-card text-admin-muted"
                )}
              >
                {savedCount} / {question_count}
              </span>
            </div>

            <StageRail
              stages={QUIZ_STAGES}
              current={stage}
              next={nextRoundStage(stage)}
              themeFor={(key) => QUIZ_STAGE_THEME[key]}
              escape={
                drafts.length > 0
                  ? {
                      label: "Clear drafts",
                      onClick: resetDrafts,
                      disabled: isApproving,
                      icon: <Trash2 className="h-3 w-3" />,
                    }
                  : undefined
              }
            />
          </div>

          {/* ---- Scrolling body */}
          <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-[1.6fr_1fr]">
              {/* Left — questions */}
              <div className="bg-white sm:border-r sm:border-admin-line">
                {savedCount > 0 && (
                  <>
                    <p className="px-4 pt-4 pb-2 text-[11px] font-bold tracking-tight text-admin-muted sm:px-6">
                      Already saved
                    </p>
                    {savedQuestions.map((q, i) => (
                      <div
                        key={q.id}
                        className="flex items-start gap-3 border-t border-admin-line px-4 py-2.5 first:border-t-0 sm:px-6"
                      >
                        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-admin-muted/50" />
                        <div className="min-w-0">
                          <p className="text-[13px] leading-snug font-semibold text-admin-ink">
                            {q.question_no ?? i + 1}. {q.question_text}
                          </p>
                          <p className="mt-0.5 text-xs text-admin-muted">{q.answer_text}</p>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {drafts.length > 0 ? (
                  <>
                    <p className="border-t border-admin-line px-4 pt-4 pb-2 text-[11px] font-bold tracking-tight text-admin-muted sm:px-6">
                      Drafts — {selected.size} of {drafts.length} chosen
                    </p>
                    {drafts.map((q, i) => {
                      const isSelected = selected.has(i);
                      const isDuplicate = duplicateIndices.has(i);
                      const isSwapping = swappingIndex === i;

                      return (
                        <div
                          key={`${i}-${q.question.slice(0, 24)}`}
                          className={cn(
                            "flex items-start gap-3 border-t border-admin-line px-4 py-2.5 transition-opacity sm:px-6",
                            !isSelected && "opacity-45"
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => toggleDraft(i)}
                            disabled={isApproving || isSwapping}
                            aria-label={isSelected ? "Remove from round" : "Add to round"}
                            className="mt-0.5 shrink-0 disabled:pointer-events-none"
                          >
                            {isSelected ? (
                              <CheckCircle2 className="h-[18px] w-[18px] text-admin-success" />
                            ) : (
                              <Circle
                                className={cn(
                                  "h-[18px] w-[18px]",
                                  atCap ? "text-admin-line" : "text-admin-muted/50"
                                )}
                              />
                            )}
                          </button>

                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] leading-snug font-semibold text-admin-ink">
                              {q.question}
                            </p>
                            <p className="mt-0.5 text-xs text-admin-muted">{q.answer}</p>
                            {isDuplicate && (
                              <p className="mt-1 text-[11px] font-semibold text-red-600">
                                Already saved to this round
                              </p>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleSwap(i)}
                            disabled={isApproving || swappingIndex !== null}
                            aria-label="Swap this question"
                            title="Swap this question"
                            className="mt-0.5 shrink-0 text-admin-muted/60 transition-colors hover:text-admin-primary disabled:pointer-events-none disabled:opacity-40"
                          >
                            {isSwapping ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <div className="border-t border-admin-line px-6 py-12 text-center">
                    <p className="text-xs font-semibold text-admin-muted">
                      {isComplete
                        ? "This round is full. Generate extras if you want spares on the night."
                        : `Add a topic if you want one, then generate ${needed} question${
                            needed === 1 ? "" : "s"
                          }.`}
                    </p>
                  </div>
                )}
              </div>

              {/* Right — setup, stays put while drafts scroll */}
              <div className="space-y-4 border-t border-admin-line p-4 sm:border-t-0 sm:p-6">
                <div className="space-y-1.5">
                  <label
                    htmlFor={`round-topic-${categoryConfigId}`}
                    className="ml-1 block font-bold text-xs text-admin-muted"
                  >
                    Topic
                  </label>
                  <input
                    id={`round-topic-${categoryConfigId}`}
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="90s britpop"
                    disabled={isGenerating}
                    className="h-11 w-full rounded-xl border-2 border-admin-line bg-white px-3 text-xs font-semibold text-admin-ink outline-none placeholder:text-admin-muted/50 focus:border-admin-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <span className="ml-1 block font-bold text-xs text-admin-muted">Difficulty</span>
                  <div className="flex overflow-hidden rounded-xl border-2 border-admin-line bg-white">
                    {DIFFICULTIES.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDifficulty(d)}
                        className={cn(
                          "flex-1 py-2.5 text-[12px] font-semibold tracking-wide transition-colors",
                          difficulty === d
                            ? "bg-admin-primary text-white"
                            : "text-admin-muted hover:bg-admin-bg"
                        )}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-admin-primary text-[12px] font-semibold text-white transition-colors hover:bg-admin-primary-hover disabled:pointer-events-none disabled:opacity-40"
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {isGenerating
                    ? "Generating"
                    : `Generate ${generationCount(savedCount, question_count)}`}
                </button>

                <p className="px-1 text-[11px] leading-relaxed text-admin-muted">
                  A few spare are generated so you can drop the weak ones. Ticking stops
                  at {selectionCap}.
                </p>
              </div>
            </div>
          </div>

          {/* ---- Sticky footer. Warnings dock here, next to what they block. */}
          <div className="shrink-0 border-t border-admin-line bg-admin-surface">
            {warning && (
              <div className="flex items-start gap-2 border-b border-red-100 bg-red-50 px-4 py-2.5 sm:px-6">
                <AlertCircle className="mt-px h-4 w-4 shrink-0 text-red-600" />
                <p className="text-[12px] leading-snug font-semibold text-red-700">{warning}</p>
              </div>
            )}

            <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
              <p className="min-w-0 truncate text-[12px] font-semibold text-admin-muted">
                {footerMessage}
              </p>
              <span className="flex-1" />

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-11 shrink-0 rounded-xl border-2 border-admin-line bg-white px-4 text-[12px] font-semibold text-admin-muted transition-colors hover:bg-admin-bg"
              >
                Close
              </button>

              {drafts.length > 0 ? (
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={isApproving || selected.size === 0}
                  className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-admin-primary px-5 text-[12px] font-semibold text-white transition-colors hover:bg-admin-primary-hover disabled:pointer-events-none disabled:opacity-40"
                >
                  {isApproving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Approve {selected.size}
                </button>
              ) : justApproved && nextRound ? (
                <span className="flex h-11 shrink-0 items-center gap-2 rounded-xl border border-admin-success/25 bg-admin-success-bg px-4 text-[12px] font-semibold text-admin-success">
                  <ArrowRight className="h-4 w-4" />
                  Next: {nextRound.categoryName} ({nextRound.savedCount}/
                  {nextRound.targetCount})
                </span>
              ) : (
                justApproved && (
                  <span className="flex h-11 shrink-0 items-center gap-2 rounded-xl border border-admin-success/25 bg-admin-success-bg px-4 text-[12px] font-semibold text-admin-success">
                    <CheckCircle2 className="h-4 w-4" />
                    Quiz ready
                  </span>
                )
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
