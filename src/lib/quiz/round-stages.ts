// src/lib/quiz/round-stages.ts
//
// Shared constants for the quiz round lifecycle, in the same shape as the band
// pipeline constants so one rail component can render either.
//
// Quiz stages are DERIVED from data, not chosen by the user. Nothing here writes
// a stage; deriveRoundStage() reads one.

export type QuizRoundStage = "empty" | "reviewing" | "complete" | "locked";

export interface StageTheme {
  label: string;
  bg: string;
  text: string;
  border: string;
  dot: string;
}

export const QUIZ_STAGE_THEME: Record<QuizRoundStage, StageTheme> = {
  empty: {
    label: "Not started",
    bg: "bg-admin-card",
    text: "text-admin-muted",
    border: "border-admin-line",
    dot: "bg-admin-muted",
  },
  reviewing: {
    label: "Reviewing",
    bg: "bg-admin-warning-bg",
    text: "text-admin-warning",
    border: "border-admin-warning/25",
    dot: "bg-admin-warning",
  },
  complete: {
    label: "Complete",
    bg: "bg-admin-success-bg",
    text: "text-admin-success",
    border: "border-admin-success/25",
    dot: "bg-admin-success",
  },
  locked: {
    label: "Locked",
    bg: "bg-admin-primary/10",
    text: "text-admin-primary",
    border: "border-admin-primary/25",
    dot: "bg-admin-primary",
  },
};

export const QUIZ_STAGES: { key: QuizRoundStage; label: string }[] = [
  { key: "empty", label: QUIZ_STAGE_THEME.empty.label },
  { key: "reviewing", label: QUIZ_STAGE_THEME.reviewing.label },
  { key: "complete", label: QUIZ_STAGE_THEME.complete.label },
];

export function deriveRoundStage(args: {
  savedCount: number;
  targetCount: number;
  draftCount: number;
  isLocked?: boolean;
}): QuizRoundStage {
  if (args.isLocked) return "locked";
  if (args.draftCount > 0) return "reviewing";
  if (args.targetCount > 0 && args.savedCount >= args.targetCount) return "complete";
  return "empty";
}

// The stage being worked towards — dashed outline in the rail, the way OFFERED
// reads in the band sheet.
export function nextRoundStage(current: QuizRoundStage): QuizRoundStage | null {
  const order: QuizRoundStage[] = ["empty", "reviewing", "complete"];
  const i = order.indexOf(current);
  return i >= 0 && i < order.length - 1 ? order[i + 1] : null;
}

// Over-generate so curation is "which do I drop" rather than "am I allowed to
// approve this many". Three spare covers a duplicate or two and one dud without
// a second round trip.
export const DRAFT_BUFFER = 3;

export function questionsNeeded(savedCount: number, targetCount: number): number {
  return Math.max(0, targetCount - savedCount);
}

export function generationCount(savedCount: number, targetCount: number): number {
  const needed = questionsNeeded(savedCount, targetCount);
  return needed > 0 ? needed + DRAFT_BUFFER : DRAFT_BUFFER;
}

// Loose comparison — punctuation and casing vary between generations even when
// the question is effectively the same one.
export function normaliseQuestion(text: string | null | undefined): string {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function findDuplicateIndices(
  drafts: { question: string }[],
  previousQuestions: (string | null | undefined)[]
): Set<number> {
  const seen = new Set(previousQuestions.map(normaliseQuestion).filter(Boolean));
  const dupes = new Set<number>();

  drafts.forEach((d, i) => {
    const key = normaliseQuestion(d.question);
    if (!key) return;
    // A single batch can also repeat itself.
    if (seen.has(key)) dupes.add(i);
    else seen.add(key);
  });

  return dupes;
}
