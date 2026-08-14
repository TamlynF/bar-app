"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Brain,
  BookOpen,
  CalendarDays,
  ChevronDown,
  Gauge,
  ImageIcon,
  Music,
  Search,
  Sparkles,
  Tag,
  Target,
  X,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { SpotifyPlayer } from "@/components/spotify-player";
import JumpToTopButton from "@/components/admin/jump-to-top-button";
import QuizHistoryFilter from "./quiz-history-filter";
import type { QuizEventSummary } from "@/app/(private)/event-setups/quiz-generator/actions";
import { stepAnswerText } from "@/lib/quiz/higher-lower";

export type HistoryQuestion = {
  id: string;
  questionNo: number | null;
  questionText: string;
  answerText: string;
  answerTextExt: string | null;
  imageUrl: string | null;
  spotifyTrackId: string | null;
  hintYear: number | null;
  releaseYear: number | null;
  topic: string | null;
  difficulty: string | null;
  categoryName: string;
  categoryOrder: number | null;
  isPicture: boolean;
  includeSpotify: boolean;
  isHigherLower: boolean;
  eventId: number | null;
  eventTitle: string | null;
  eventDate: string | null;
};

type Props = {
  questions: HistoryQuestion[];
  quizEvents: QuizEventSummary[];
  currentFilter: string;
  nextQuiz: QuizEventSummary | null;
};

const formatEventDate = (date: string | null) =>
  date ? format(new Date(`${date}T00:00:00`), "EEE d MMM yyyy") : "No date";

const difficultyTone = (difficulty: string) => {
  const value = difficulty.toLowerCase();
  if (value === "easy") return "border-admin-success/25 bg-admin-success-bg text-admin-success";
  if (value === "hard") return "border-admin-error/25 bg-admin-error-bg text-admin-error";
  return "border-admin-warning/25 bg-admin-warning-bg text-admin-warning";
};

export default function QuizHistoryList({ questions, quizEvents, currentFilter, nextQuiz }: Props) {
  const [search, setSearch] = useState("");
  const groupByEvent = currentFilter === "all";
  const term = search.trim().toLowerCase();

  const categories = useMemo(() => {
    const matches = term
      ? questions.filter((q) =>
          [q.questionText, q.answerText, q.answerTextExt, q.topic, q.categoryName, q.eventTitle]
            .filter(Boolean)
            .some((field) => (field as string).toLowerCase().includes(term))
        )
      : questions;

    const byCategory = new Map<string, HistoryQuestion[]>();
    for (const question of matches) {
      const existing = byCategory.get(question.categoryName);
      if (existing) existing.push(question);
      else byCategory.set(question.categoryName, [question]);
    }

    return [...byCategory.entries()]
      .map(([categoryName, rows]) => {
        const byEvent = new Map<string, HistoryQuestion[]>();
        for (const row of rows) {
          const key = row.eventId != null ? String(row.eventId) : `unlinked-${row.eventDate ?? "none"}`;
          const existing = byEvent.get(key);
          if (existing) existing.push(row);
          else byEvent.set(key, [row]);
        }

        const events = [...byEvent.entries()]
          .map(([key, rows]) => ({
            key,
            title: rows[0].eventTitle,
            date: rows[0].eventDate,
            questions: [...rows].sort((a, b) => (a.questionNo ?? 0) - (b.questionNo ?? 0)),
          }))
          .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

        return {
          categoryName,
          order: rows[0].categoryOrder,
          isPicture: rows[0].isPicture,
          includeSpotify: rows[0].includeSpotify,
          isHigherLower: rows[0].isHigherLower,
          total: rows.length,
          events,
        };
      })
      .sort((a, b) => {
        const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
        const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        return a.categoryName.localeCompare(b.categoryName);
      });
  }, [questions, term]);

  const matchCount = categories.reduce((sum, category) => sum + category.total, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <QuizHistoryFilter quizEvents={quizEvents} currentFilter={currentFilter} />

        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-admin-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search questions"
            placeholder="Search questions, answers or topics"
            className="h-12 w-full rounded-2xl border border-admin-line bg-admin-card pr-11 pl-9 text-base text-admin-ink outline-none placeholder:text-admin-muted focus:border-admin-primary sm:text-sm"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              title="Clear search"
              className="absolute top-1/2 right-1.5 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-admin-muted transition-colors hover:bg-admin-surface hover:text-admin-ink"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {nextQuiz && (
          <Link
            href={`/event-setups/events/${nextQuiz.id}`}
            className="flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl border border-admin-primary px-4 text-[13px] font-semibold text-admin-primary transition-colors hover:bg-admin-primary-soft"
          >
            <Sparkles className="h-4 w-4 shrink-0" />
            Build {format(new Date(`${nextQuiz.date}T00:00:00`), "EEE d MMM")} quiz
          </Link>
        )}
      </div>

      {term && (
        <p className="px-1 text-[13px] font-medium text-admin-muted tabular-nums">
          {matchCount} question{matchCount === 1 ? "" : "s"} matching &ldquo;{search.trim()}&rdquo;
        </p>
      )}

      {categories.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-admin-line bg-admin-card py-16 text-center">
          <BookOpen className="mb-3 h-8 w-8 text-admin-muted opacity-30" />
          <p className="text-sm font-semibold text-admin-ink">
            {term ? "No matching questions" : "Archive is empty"}
          </p>
          <p className="mt-1 max-w-xs px-6 text-[13px] leading-normal text-admin-muted">
            {term
              ? "Try a different word, or clear the search to see the whole archive."
              : "There are no approved questions for this filter yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map((category) => (
            <CategoryHistorySection
              key={category.categoryName}
              categoryName={category.categoryName}
              total={category.total}
              isPicture={category.isPicture}
              includeSpotify={category.includeSpotify}
              isHigherLower={category.isHigherLower}
              events={category.events}
              groupByEvent={groupByEvent}
              forceOpen={!!term}
            />
          ))}
          <JumpToTopButton />
        </div>
      )}
    </div>
  );
}

type EventGroup = {
  key: string;
  title: string | null;
  date: string | null;
  questions: HistoryQuestion[];
};

function CategoryHistorySection({
  categoryName,
  total,
  isPicture,
  includeSpotify,
  isHigherLower,
  events,
  groupByEvent,
  forceOpen,
}: {
  categoryName: string;
  total: number;
  isPicture: boolean;
  includeSpotify: boolean;
  isHigherLower: boolean;
  events: EventGroup[];
  groupByEvent: boolean;
  forceOpen: boolean;
}) {
  const [open, setOpen] = useState(false);
  const isOpen = forceOpen || open;
  const RoundIcon = isPicture ? ImageIcon : includeSpotify ? Music : Brain;
  const flatQuestions = events.flatMap((group) => group.questions);

  return (
    <section data-category-section className="overflow-hidden rounded-2xl border border-admin-line bg-admin-card">
      <div className="flex flex-nowrap items-center gap-2 border-b border-admin-line bg-admin-surface px-2 py-2.5 sm:gap-3 sm:px-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={isOpen}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl px-1 text-left transition-colors hover:bg-admin-card/60"
        >
          <RoundIcon className="h-4 w-4 shrink-0 text-admin-muted" />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-bold tracking-tight text-admin-primary sm:truncate sm:text-[15px]">
              {categoryName}
            </p>
            <p className="mt-0.5 text-xs font-medium text-admin-muted tabular-nums">
              {total} question{total === 1 ? "" : "s"}
              {groupByEvent && ` across ${events.length} quiz${events.length === 1 ? "" : "zes"}`}
            </p>
          </div>
        </button>

        <span className="hidden w-18.5 shrink-0 rounded-lg border border-admin-line bg-admin-card py-2 text-center text-[13px] font-semibold text-admin-muted tabular-nums sm:block">
          {total}
        </span>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={isOpen}
          aria-label={isOpen ? `Hide ${categoryName} questions` : `Show ${categoryName} questions`}
          title={isOpen ? "Hide questions" : "Show questions"}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-admin-line bg-admin-card text-admin-muted transition-colors hover:bg-admin-primary-soft hover:text-admin-primary"
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isOpen && "rotate-180")} />
        </button>
      </div>

      {isOpen && (
        <div className="space-y-2 bg-admin-bg p-2 sm:space-y-3 sm:p-3">
          {groupByEvent
            ? events.map((group) => (
                <EventHistoryGroup
                  key={group.key}
                  group={group}
                  isPicture={isPicture}
                  includeSpotify={includeSpotify}
                  isHigherLower={isHigherLower}
                  forceOpen={forceOpen}
                />
              ))
            : flatQuestions.map((question) => (
                <HistoryQuestionCard
                  key={question.id}
                  question={question}
                  isPicture={isPicture}
                  includeSpotify={includeSpotify}
                  isHigherLower={isHigherLower}
                />
              ))}
        </div>
      )}
    </section>
  );
}

function EventHistoryGroup({
  group,
  isPicture,
  includeSpotify,
  isHigherLower,
  forceOpen,
}: {
  group: EventGroup;
  isPicture: boolean;
  includeSpotify: boolean;
  isHigherLower: boolean;
  forceOpen: boolean;
}) {
  const [open, setOpen] = useState(false);
  const isOpen = forceOpen || open;
  const label = group.title || "Quiz night";

  return (
    <div className="overflow-hidden rounded-xl border border-admin-line bg-admin-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={isOpen}
        className="flex min-h-11 w-full items-center gap-2.5 px-2.5 py-2 text-left transition-colors hover:bg-admin-surface sm:px-3"
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-admin-muted" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-admin-ink">{label}</p>
          <p className="mt-0.5 text-xs font-medium text-admin-muted tabular-nums">
            {formatEventDate(group.date)} - {group.questions.length} question
            {group.questions.length === 1 ? "" : "s"}
          </p>
        </div>
        <ChevronDown
          aria-hidden
          className={cn(
            "h-4 w-4 shrink-0 text-admin-muted transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {isOpen && (
        <div className="space-y-2 border-t border-admin-line bg-admin-bg p-2 sm:space-y-3">
          {group.questions.map((question) => (
            <HistoryQuestionCard
              key={question.id}
              question={question}
              isPicture={isPicture}
              includeSpotify={includeSpotify}
              isHigherLower={isHigherLower}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryQuestionCard({
  question,
  isPicture,
  includeSpotify,
  isHigherLower,
}: {
  question: HistoryQuestion;
  isPicture: boolean;
  includeSpotify: boolean;
  isHigherLower: boolean;
}) {
  const isHigherOrLower = includeSpotify && isHigherLower;
  const hideQuestionText = includeSpotify && !isHigherLower;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-admin-line bg-admin-card p-3 shadow-sm sm:p-4">
      <div className="space-y-2">
        <div className="-mt-1 flex flex-wrap items-center justify-between gap-2">
          <span className="shrink-0 font-bold text-sm text-admin-primary">
            <span className="sm:hidden">Q {question.questionNo ?? "-"}:</span>
            <span className="hidden sm:inline">Question {question.questionNo ?? "-"}:</span>
          </span>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {question.topic && (
              <span
                title={`Topic: ${question.topic}`}
                className="inline-flex max-w-50 items-center gap-1 rounded-lg border border-admin-line bg-admin-surface px-2 py-1 text-[11px] font-semibold text-admin-muted"
              >
                <Tag className="h-3 w-3 shrink-0" />
                <span className="truncate">{question.topic}</span>
              </span>
            )}
            {question.difficulty && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold",
                  difficultyTone(question.difficulty)
                )}
              >
                <Gauge className="h-3 w-3 shrink-0" />
                {question.difficulty}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {isHigherOrLower && question.hintYear ? (
            <div className="space-y-2">
              <p className="text-sm leading-snug text-admin-ink">
                <span className="font-bold italic">{question.answerTextExt ?? question.answerText}</span> higher or lower than{" "}
                <span className="font-bold text-admin-warning">{question.hintYear}</span>?
              </p>
              <div className="flex w-full items-center justify-center gap-2 rounded-xl bg-admin-primary px-3 py-2 text-white shadow-sm">
                <Target className="h-3 w-3 shrink-0 text-white/50" />
                <span className="text-center font-bold text-xs tracking-tight">
                  {stepAnswerText(question.releaseYear ?? 0, question.hintYear)}
                </span>
              </div>
            </div>
          ) : (
            <>
              {question.imageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={question.imageUrl}
                  alt={question.answerText}
                  className="h-40 w-full rounded-xl object-cover sm:h-56 sm:w-auto sm:max-w-full sm:object-contain"
                />
              ) : (
                (!includeSpotify || !question.spotifyTrackId) &&
                question.questionText && (
                  <p className="text-sm leading-normal text-admin-ink">{question.questionText}</p>
                )
              )}
              {hideQuestionText && question.spotifyTrackId && (
                <SpotifyPlayer trackId={question.spotifyTrackId} title={question.answerText} compact />
              )}
              <div className="flex w-full items-center justify-center gap-2 rounded-xl bg-admin-primary px-3 py-2 text-white shadow-sm sm:w-fit sm:min-w-50">
                <Target className="h-3 w-3 shrink-0 text-white/50" />
                <span className="text-center font-bold text-xs tracking-tight">{question.answerText}</span>
              </div>
            </>
          )}
        </div>

        {includeSpotify && question.spotifyTrackId && !hideQuestionText && (
          <SpotifyPlayer
            trackId={question.spotifyTrackId}
            title={question.answerTextExt ?? question.answerText}
            compact
          />
        )}
        {isPicture && !question.imageUrl && question.questionText && (
          <p className="text-[13px] font-medium text-admin-muted">{question.questionText}</p>
        )}
      </div>
    </div>
  );
}
