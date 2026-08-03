"use client";

// src/app/(private)/event-setups/events/[id]/quiz-round-sheet.tsx
//
// Replaces the trip out to /event-setups/quiz-generator for every round type.
// The round is built in place, in a single-column sheet that reads
// top-to-bottom like a set of instructions:
//
//   sticky header  - round name, plain-English subtitle, segmented progress bar
//   scrolling body - step 1 (create), step 2 (pick), saved questions collapsed
//   sticky footer  - a status sentence that counts down to done, then Add
//
// What differs from the old generator, and why:
//
//   1. Event and category arrive as props. There are no dropdowns, so the two
//      cannot drift apart from the round you opened.
//   2. Generation over-produces (needed + DRAFT_BUFFER) and selection is capped
//      at exactly what the round needs. "Over limit" is now unreachable rather
//      than a red error you have to go and resolve.
//   3. Partial adds are allowed, and approving never empties the screen - the
//      body becomes a success view that offers the rest of the round.
//
// One skeleton serves all three round types; only the card body, the noun in
// the copy, and the pair of server actions vary:
//
//   question - generateQuizAction        / saveQuizToDatabase
//   picture  - generatePictureRoundAction / savePictureRoundAction  (topic is
//              required, and locked once the round has pictures, because every
//              row in a picture round shares one question_text)
//   song     - generateMusicSnippetsAction / saveMusicSnippetsAction (saving
//              also syncs the round's Spotify playlist)

import React, { useCallback, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Sparkles,
  Plus,
  Loader2,
  RefreshCw,
  Lock,
  Check,
  CheckCircle2,
  ChevronDown,
  PartyPopper,
  ArrowRight,
  ImageIcon,
  Music,
  ExternalLink,
} from "lucide-react";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SpotifyPlayer } from "@/components/spotify-player";
import { cn } from "@/lib/utils";

function DfSpinner({ className }: { className?: string }) {
  return (
    <Image
      src="/df-mark.jpg"
      alt=""
      aria-hidden="true"
      width={96}
      height={96}
      className={cn(
        "animate-spin rounded-full object-cover [animation-duration:1.6s]",
        className
      )}
    />
  );
}

import {
  generateQuizAction,
  saveQuizToDatabase,
  generatePictureRoundAction,
  savePictureRoundAction,
  generateMusicSnippetsAction,
  saveMusicSnippetsAction,
  type QuizQuestion,
  type PictureRoundItem,
  type MusicSnippetCandidate,
} from "@/app/(private)/event-setups/quiz-generator/actions";

import {
  generationCount,
  questionsNeeded,
  findDuplicateIndices,
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
  answer_text_ext?: string | null;
  question_no?: number | null;
  image_url?: string | null;
  spotify_track_id?: string | null;
  release_year?: number | null;
  hint_year?: number | null;
};

type RoundKind = "question" | "picture" | "song";
type DraftItem = QuizQuestion | PictureRoundItem | MusicSnippetCandidate;

type ApprovedSummary = {
  added: DraftItem[];
  savedAfter: number;
  playlistSynced?: boolean;
};

interface QuizRoundSheetProps {
  eventId: number;
  categoryConfigId: number;
  category_name: string;
  question_count: number;
  savedQuestions: SavedQuestion[];
  orderNo?: number;
  includeSpotify?: boolean;
  isPicture?: boolean;
  isHigherLower?: boolean;
  playlistUrl?: string | null;
  spotifyConnected?: boolean;
  autoOpen?: boolean;
  // Shown on the success view once the round is filled.
  nextRound?: NextRoundSummary | null;
  // Fired after a successful approve, so the parent can refresh its list.
  onApproved?: () => void;
  // Saving songs syncs the playlist, so the parent can pick up a fresh URL.
  onPlaylistUrl?: (url: string) => void;
}

const isSongDraft = (d: DraftItem): d is MusicSnippetCandidate => "artist" in d;
const isPictureDraft = (d: DraftItem): d is PictureRoundItem => "imageUrl" in d;
const isQuestionDraft = (d: DraftItem): d is QuizQuestion => "question" in d;

const draftIdentity = (d: DraftItem): string => {
  if (isSongDraft(d)) return `${d.artist} - ${d.title}`;
  if (isQuestionDraft(d)) return d.question;
  return d.answer;
};

const higherOrLowerQuestion = (s: MusicSnippetCandidate) =>
  `${s.artist} - ${s.title} is higher or lower than ${s.hint_year}?`;

const higherOrLowerAnswer = (s: MusicSnippetCandidate) =>
  s.year > (s.hint_year ?? 0) ? "Higher" : "Lower";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default function QuizRoundSheet({
  eventId,
  categoryConfigId,
  category_name,
  question_count,
  savedQuestions,
  orderNo,
  includeSpotify = false,
  isPicture = false,
  isHigherLower = false,
  playlistUrl = null,
  spotifyConnected = false,
  autoOpen = false,
  nextRound = null,
  onApproved,
  onPlaylistUrl,
}: QuizRoundSheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(autoOpen);
  // "Continue building quiz" navigates to this page with the round already
  // targeted; the component is usually still mounted, so react to the prop
  // rather than only to the initial state.
  const [wasAutoOpen, setWasAutoOpen] = useState(autoOpen);
  if (autoOpen !== wasAutoOpen) {
    setWasAutoOpen(autoOpen);
    if (autoOpen) setOpen(true);
  }

  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("Medium");
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const [isGenerating, setIsGenerating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [swappingIndex, setSwappingIndex] = useState<number | null>(null);

  const [setupOpen, setSetupOpen] = useState(true);
  const [savedOpen, setSavedOpen] = useState(false);
  const [topicMissing, setTopicMissing] = useState(false);
  // The pre-tick is announced once; it stops being news the moment the person
  // takes over the selection themselves.
  const [autoPickShown, setAutoPickShown] = useState(false);
  const [approved, setApproved] = useState<ApprovedSummary | null>(null);
  // Picture answers already drafted in this sitting, so a swap or a second
  // batch doesn't hand back the same subject.
  const [draftedAnswers, setDraftedAnswers] = useState<string[]>([]);

  const topicRef = useRef<HTMLInputElement>(null);

  const kind: RoundKind = isPicture ? "picture" : includeSpotify ? "song" : "question";
  const isHigherOrLower = includeSpotify && isHigherLower;
  const noun = kind === "picture" ? "picture" : kind === "song" ? "song" : "question";

  const savedCount = savedQuestions.length;
  const needed = questionsNeeded(savedCount, question_count);
  const hasAny = savedCount > 0;
  const isComplete = question_count > 0 && savedCount >= question_count;
  const batchSize = generationCount(savedCount, question_count);

  // Every row in a picture round shares one question_text, so the first saved
  // picture fixes the topic for the rest of the round.
  const lockedTopic = isPicture
    ? (savedQuestions.find((q) => q.question_text)?.question_text ?? "")
    : "";
  const topicLocked = isPicture && lockedTopic.length > 0;
  const effectiveTopic = topicLocked ? lockedTopic : topic;

  const previousIdentities = useMemo(
    () =>
      savedQuestions.map((q) => {
        if (kind === "picture") return q.answer_text;
        if (kind === "song") return q.answer_text_ext ?? q.answer_text;
        return q.question_text;
      }),
    [savedQuestions, kind]
  );

  const duplicateIndices = useMemo(
    () =>
      findDuplicateIndices(
        drafts.map((d) => ({ question: draftIdentity(d) })),
        previousIdentities
      ),
    [drafts, previousIdentities]
  );

  const selectionCap = needed > 0 ? needed : question_count;
  const atCap = selected.size >= selectionCap;

  const savedListId = `round-saved-${categoryConfigId}`;
  const topicId = `round-topic-${categoryConfigId}`;

  const resetDrafts = useCallback(() => {
    setDrafts([]);
    setSelected(new Set());
    setAutoPickShown(false);
  }, []);

  const requestDrafts = useCallback(
    async (count: number): Promise<{ items?: DraftItem[]; error?: string }> => {
      if (kind === "picture") {
        const result = await generatePictureRoundAction(
          count,
          effectiveTopic,
          difficulty,
          eventId,
          categoryConfigId,
          draftedAnswers
        );
        return { items: result.items, error: result.error };
      }

      if (kind === "song") {
        const result = await generateMusicSnippetsAction(
          count,
          effectiveTopic,
          difficulty,
          eventId,
          categoryConfigId
        );
        return { items: result.songs, error: result.error };
      }

      const result = await generateQuizAction(
        effectiveTopic,
        category_name,
        count,
        difficulty,
        eventId,
        categoryConfigId
      );
      return { items: result.questions, error: result.error };
    },
    [kind, effectiveTopic, difficulty, eventId, categoryConfigId, category_name, draftedAnswers]
  );

  const handleGenerate = useCallback(async () => {
    if (isGenerating) return;

    if (isPicture && !effectiveTopic.trim()) {
      setTopicMissing(true);
      setSetupOpen(true);
      topicRef.current?.focus();
      return;
    }

    setTopicMissing(false);
    setApproved(null);
    setIsGenerating(true);

    try {
      const { items, error } = await requestDrafts(batchSize);

      if (error || !items?.length) {
        toast.error(error || "Nothing came back. Try again.");
        return;
      }

      setDrafts(items);
      setDraftedAnswers((prev) => [...prev, ...items.map(draftIdentity)]);
      setSetupOpen(false);

      // Pre-tick exactly what the round needs, skipping anything that repeats a
      // question already saved. Unticking one dud beats ticking nine keepers.
      const dupes = findDuplicateIndices(
        items.map((d) => ({ question: draftIdentity(d) })),
        previousIdentities
      );
      const cap = needed > 0 ? needed : question_count;
      const preselect = new Set<number>();
      for (let i = 0; i < items.length; i++) {
        if (preselect.size >= cap) break;
        if (dupes.has(i)) continue;
        preselect.add(i);
      }
      setSelected(preselect);
      setAutoPickShown(preselect.size > 0);
    } catch {
      toast.error("Could not reach the generator.");
    } finally {
      setIsGenerating(false);
    }
  }, [
    isGenerating,
    isPicture,
    effectiveTopic,
    requestDrafts,
    batchSize,
    previousIdentities,
    needed,
    question_count,
  ]);

  // Replace one draft rather than binning the batch.
  const handleSwap = useCallback(
    async (index: number) => {
      if (swappingIndex !== null) return;
      setSwappingIndex(index);
      setAutoPickShown(false);

      try {
        const { items, error } = await requestDrafts(1);
        const replacement = items?.[0];

        if (error || !replacement) {
          toast.error(error || `No replacement ${noun} came back.`);
          return;
        }

        setDrafts((prev) => prev.map((d, i) => (i === index ? replacement : d)));
        setDraftedAnswers((prev) => [...prev, draftIdentity(replacement)]);
      } catch {
        toast.error(`Could not swap that ${noun}.`);
      } finally {
        setSwappingIndex(null);
      }
    },
    [swappingIndex, requestDrafts, noun]
  );

  const toggleDraft = useCallback(
    (index: number) => {
      setAutoPickShown(false);
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(index)) {
          next.delete(index);
          return next;
        }
        // Hard cap. A tick past the round size simply does not take - no error
        // state, no disabled Add, nothing to go and resolve.
        if (next.size >= selectionCap) {
          toast.info(`That's ${selectionCap} already - untick one first.`);
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
        .filter(Boolean);

      let playlistSynced: boolean | undefined;

      if (kind === "picture") {
        await savePictureRoundAction(
          chosen.filter(isPictureDraft),
          eventId,
          category_name,
          categoryConfigId,
          effectiveTopic,
          difficulty
        );
      } else if (kind === "song") {
        const result = await saveMusicSnippetsAction(
          chosen.filter(isSongDraft).map((s) => ({
            artist: s.artist,
            title: s.title,
            year: s.year,
            spotify_track_id: s.spotify_track_id,
            hint_year: s.hint_year,
          })),
          eventId,
          category_name,
          categoryConfigId,
          effectiveTopic,
          difficulty
        );
        playlistSynced = !result?.needsConnect && !!result?.ok;
        if (result?.playlistUrl) onPlaylistUrl?.(result.playlistUrl);
      } else {
        await saveQuizToDatabase(
          chosen
            .filter(isQuestionDraft)
            // saveQuizToDatabase resolves the config row by category name, so pin
            // it to this round rather than trusting whatever the model echoed back.
            .map((q) => ({ ...q, category: category_name })),
          eventId,
          effectiveTopic,
          difficulty
        );
      }

      setApproved({ added: chosen, savedAfter: savedCount + chosen.length, playlistSynced });
      resetDrafts();
      setSetupOpen(true);
      onApproved?.();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Could not save those ${noun}s.`);
    } finally {
      setIsApproving(false);
    }
  }, [
    isApproving,
    selected,
    drafts,
    kind,
    eventId,
    category_name,
    categoryConfigId,
    effectiveTopic,
    difficulty,
    savedCount,
    noun,
    resetDrafts,
    onApproved,
    onPlaylistUrl,
    router,
  ]);

  const closeSheet = useCallback(() => setOpen(false), []);

  const keepGoing = useCallback(() => {
    setApproved(null);
    setSetupOpen(true);
  }, []);

  const subtitle = (() => {
    if (approved) {
      const remaining = Math.max(question_count - approved.savedAfter, 0);
      return remaining === 0
        ? "Round complete"
        : `${plural(remaining, `more ${noun}`)} still needed.`;
    }
    if (isComplete) return `This round is full - all ${question_count} ${noun}s are saved.`;
    return `You need ${plural(needed, `more ${noun}`)} to finish this round.`;
  })();

  // Every footer state reads as a countdown to done, never as an error.
  const footerStatus = (() => {
    if (topicMissing) return `Type a topic first - picture rounds need one.`;
    if (isGenerating) return `Creating ${noun}s…`;
    if (drafts.length === 0) {
      return isComplete
        ? `This round is full. Create extras if you want spares on the night.`
        : `Create some ${noun}s to get started.`;
    }
    if (selected.size === 0) return `Nothing picked yet - tick at least 1 ${noun} to add.`;
    if (selected.size >= needed) return "Ready - this completes the round.";
    return `${selected.size} picked - you can add now, ${plural(
      needed - selected.size,
      noun
    )} will still be needed.`;
  })();

  const footerReady = drafts.length > 0 && selected.size > 0 && selected.size >= needed;

  const pickHelp =
    kind === "picture"
      ? "On the night, guests see the picture and write down the answer. Press Swap to replace a picture you don't like."
      : kind === "song"
        ? "Press play to hear a snippet before deciding. On the night, guests hear the snippet and name the song and artist."
        : "Tap a question to pick or untick it. Don't like one? Press Swap to replace just that one.";

  const generateFootnote =
    needed > 0
      ? kind === "song"
        ? `We'll suggest ${batchSize} so you can pick your favourite ${needed}. Picked songs go straight onto the round's Spotify playlist.`
        : `We'll create ${batchSize} so you can pick your favourite ${needed} and skip the rest.`
      : `We'll create ${batchSize} spares so you can pick the ones you like.`;

  const spotifyLoginHref = `/api/spotify/login?return=${encodeURIComponent(
    `/event-setups/events/${eventId}`
  )}`;

  return (
    <>
      {/* Trigger - fills the round row's fixed action slot */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={hasAny ? `Add ${needed} more` : "Start round"}
        title={hasAny ? `Add ${needed} more` : "Start round"}
        className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-1.5 rounded-xl bg-admin-primary text-[13px] font-semibold text-white transition-colors hover:bg-admin-primary-hover sm:px-3"
      >
        <Plus className="h-4 w-4 shrink-0 sm:hidden" />
        <Sparkles className="hidden h-4 w-4 shrink-0 sm:block" />
        <span className="hidden sm:inline">{hasAny ? `Add ${needed} more` : "Start round"}</span>
      </button>

      <Sheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            resetDrafts();
            setApproved(null);
            setSetupOpen(true);
            setSavedOpen(false);
            setTopicMissing(false);
            setDraftedAnswers([]);
          }
        }}
      >
        <SheetContent
          side="bottom"
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="flex h-[90vh] flex-col gap-0 overflow-hidden rounded-t-3xl border-t border-admin-line bg-admin-bg p-0 outline-none
            sm:inset-x-auto sm:bottom-6 sm:left-1/2 sm:h-auto sm:max-h-[88vh] sm:w-3xl
            sm:max-w-[95vw] sm:-translate-x-1/2 sm:rounded-3xl sm:border"
        >
          {/* ---- Sticky header */}
          <div className="shrink-0 border-b border-admin-line bg-admin-surface px-4 pt-4 pb-3.5 sm:px-6">
            <SheetTitle className="pr-8 text-base font-bold tracking-tight text-admin-ink sm:text-lg">
              {orderNo != null ? `Round ${orderNo} · ` : ""}
              {category_name}
            </SheetTitle>
            <p className="mt-1 pr-8 text-[13px] font-medium text-admin-muted">{subtitle}</p>

            {question_count > 0 && (
              <div className="mt-3.5 flex items-center gap-3">
                <div className="flex flex-1 gap-1" aria-hidden="true">
                  {Array.from({ length: question_count }, (_, i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-2.5 flex-1 rounded-full",
                        i < savedCount
                          ? "bg-admin-primary"
                          : i < savedCount + selected.size
                            ? "animate-pulse bg-admin-warning"
                            : "bg-admin-line"
                      )}
                    />
                  ))}
                </div>
                <span className="shrink-0 text-[13px] font-bold text-admin-primary tabular-nums">
                  {savedCount}
                  {selected.size > 0 ? ` + ${selected.size}` : ""} of {question_count}
                </span>
              </div>
            )}
          </div>

          {approved ? (
            /* ---- Success view - replaces body and footer */
            <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto px-4 py-8 text-center sm:px-6">
              {(() => {
                const remaining = Math.max(question_count - approved.savedAfter, 0);
                const complete = remaining === 0;

                return (
                  <>
                    <span
                      className={cn(
                        "mx-auto flex h-14 w-14 items-center justify-center rounded-full",
                        complete
                          ? "bg-admin-success-bg text-admin-success"
                          : "bg-admin-primary-soft text-admin-primary"
                      )}
                    >
                      {complete ? (
                        <PartyPopper className="h-7 w-7" />
                      ) : (
                        <CheckCircle2 className="h-7 w-7" />
                      )}
                    </span>

                    <h2 className="mt-4 text-lg font-bold tracking-tight text-admin-ink">
                      {complete
                        ? "Round complete!"
                        : `${plural(approved.added.length, noun)} added`}
                    </h2>
                    <p className="mx-auto mt-1.5 max-w-100 text-sm text-admin-muted">
                      {complete
                        ? `${category_name} now has all ${approved.savedAfter} of ${question_count} ${noun}s.`
                        : `${category_name} now has ${approved.savedAfter} of ${question_count} - ${plural(
                            remaining,
                            noun
                          )} still needed.`}
                    </p>

                    <div className="mx-auto mt-5 max-w-125 overflow-hidden rounded-2xl border border-admin-line bg-admin-card text-left">
                      {approved.added.map((d, i) => (
                        <div
                          key={`${i}-${draftIdentity(d).slice(0, 24)}`}
                          className="flex items-center gap-3 border-t border-admin-line px-4 py-3 first:border-t-0"
                        >
                          <Check className="h-4 w-4 shrink-0 text-admin-success" />
                          <p className="min-w-0 flex-1 text-[13px] leading-snug font-semibold text-admin-ink">
                            {isSongDraft(d)
                              ? `${d.title} - ${d.artist}`
                              : isPictureDraft(d)
                                ? "Picture card"
                                : d.question}
                          </p>
                          <p className="shrink-0 text-[13px] font-semibold text-admin-primary">
                            {isSongDraft(d)
                              ? isHigherOrLower
                                ? higherOrLowerAnswer(d)
                                : d.year
                              : isPictureDraft(d)
                                ? d.answer
                                : d.answer}
                          </p>
                        </div>
                      ))}
                    </div>

                    {kind === "song" && (
                      <p className="mx-auto mt-4 flex max-w-125 items-center justify-center gap-2 rounded-xl border border-admin-success/25 bg-admin-success-bg px-4 py-2.5 text-[13px] font-semibold text-admin-success">
                        <Music className="h-4 w-4 shrink-0" />
                        {approved.playlistSynced
                          ? `Spotify playlist updated - the ${plural(
                              approved.added.length,
                              "new song"
                            )} ${approved.added.length === 1 ? "was" : "were"} added automatically.`
                          : "Songs saved. Connect Spotify to add them to the round's playlist."}
                      </p>
                    )}

                    {complete && nextRound && (
                      <p className="mx-auto mt-4 flex max-w-125 items-center justify-center gap-2 rounded-xl border border-admin-line bg-admin-surface px-4 py-2.5 text-[13px] font-semibold text-admin-muted">
                        <ArrowRight className="h-4 w-4 shrink-0" />
                        Next up: {nextRound.categoryName} ({nextRound.savedCount}/
                        {nextRound.targetCount})
                      </p>
                    )}

                    <div className="mt-6 flex flex-col items-center gap-2.5 sm:flex-row sm:justify-center">
                      {complete ? (
                        <button
                          type="button"
                          onClick={closeSheet}
                          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-admin-primary px-6 text-sm font-semibold text-white transition-colors hover:bg-admin-primary-hover sm:w-auto"
                        >
                          Done - back to quiz
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={keepGoing}
                            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-admin-primary px-6 text-sm font-semibold text-white transition-colors hover:bg-admin-primary-hover sm:w-auto"
                          >
                            <Sparkles className="h-4 w-4" />
                            Keep going - add the rest
                          </button>
                          <button
                            type="button"
                            onClick={closeSheet}
                            className="flex h-12 w-full items-center justify-center rounded-xl border border-admin-line bg-white px-6 text-sm font-semibold text-admin-muted transition-colors hover:bg-admin-surface sm:w-auto"
                          >
                            Close
                          </button>
                        </>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          ) : (
            <>
              {/* ---- Scrolling body */}
              <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto px-4 py-5 sm:px-6">
                {/* Spotify - picking is never blocked on connecting */}
                {kind === "song" && (
                  <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-admin-success/25 bg-admin-success-bg px-4 py-3">
                    <div className="min-w-50 flex-1">
                      <p className="text-[13px] font-semibold text-admin-success">
                        {spotifyConnected
                          ? "Spotify connected"
                          : "Connect Spotify to build this round's playlist"}
                      </p>
                      <p className="mt-0.5 text-[13px] text-admin-success/80">
                        {spotifyConnected
                          ? "Songs you approve are added to this round's playlist automatically."
                          : "You can still pick songs now - the playlist fills in once connected."}
                      </p>
                    </div>

                    {spotifyConnected ? (
                      playlistUrl && (
                        <a
                          href={playlistUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ "--spotify": "#1DB954" } as React.CSSProperties}
                          className="flex h-11 shrink-0 items-center gap-2 rounded-xl border border-(--spotify) bg-white px-4 text-[13px] font-semibold text-(--spotify) transition-colors hover:bg-admin-success-bg"
                        >
                          <Music className="h-4 w-4" />
                          Open playlist
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )
                    ) : (
                      <a
                        href={spotifyLoginHref}
                        style={{ "--spotify": "#1DB954" } as React.CSSProperties}
                        className="flex h-11 shrink-0 items-center gap-2 rounded-xl bg-(--spotify) px-4 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
                      >
                        <Music className="h-4 w-4" />
                        Connect Spotify
                      </a>
                    )}
                  </div>
                )}

                {/* Step 1 - create */}
                <section className="mb-6">
                  {setupOpen ? (
                    <>
                      <p className="mb-2.5 flex items-center gap-2 text-[12px] font-bold tracking-wide text-admin-primary uppercase">
                        <span className="flex h-5.5 w-5.5 items-center justify-center rounded-full bg-admin-primary text-[11px] font-bold text-white">
                          1
                        </span>
                        Create new {noun}s
                      </p>

                      <div className="space-y-4 rounded-2xl border border-admin-line bg-admin-card p-4">
                        <div>
                          <label
                            htmlFor={topicId}
                            className="mb-1.5 block text-[11px] font-bold tracking-wide text-admin-muted uppercase"
                          >
                            Topic{" "}
                            {isPicture ? (
                              <span className="font-semibold text-admin-warning normal-case">
                                - required for picture rounds
                              </span>
                            ) : (
                              <span className="font-medium normal-case">
                                - optional, leave blank for a general mix
                              </span>
                            )}
                          </label>
                          <input
                            id={topicId}
                            ref={topicRef}
                            value={effectiveTopic}
                            onChange={(e) => {
                              setTopic(e.target.value);
                              if (e.target.value.trim()) setTopicMissing(false);
                            }}
                            placeholder={
                              kind === "picture"
                                ? "e.g. Dog breeds, World flags, Famous landmarks…"
                                : kind === "song"
                                  ? "e.g. 80s, Rock, Christmas…"
                                  : "Type a topic, e.g. 90s britpop"
                            }
                            disabled={isGenerating || topicLocked}
                            className={cn(
                              "h-12 w-full rounded-xl border bg-white px-3.5 text-sm text-admin-ink outline-none placeholder:text-admin-muted/50 focus:border-admin-primary",
                              topicMissing ? "border-admin-warning" : "border-admin-line",
                              topicLocked &&
                                "disabled:bg-admin-primary-soft disabled:font-semibold disabled:text-admin-primary"
                            )}
                          />
                          {topicLocked && (
                            <p className="mt-1.5 flex items-start gap-1.5 text-[13px] font-medium text-admin-muted">
                              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              Picture rounds keep one topic - this round is already &ldquo;
                              {lockedTopic}&rdquo;, so new pictures stay on that topic.
                            </p>
                          )}
                        </div>

                        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                          <div className="sm:max-w-95 sm:flex-1">
                            <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-admin-muted uppercase">
                              Difficulty
                            </span>
                            <div className="flex gap-2">
                              {DIFFICULTIES.map((d) => (
                                <button
                                  key={d}
                                  type="button"
                                  onClick={() => setDifficulty(d)}
                                  aria-pressed={difficulty === d}
                                  className={cn(
                                    "flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl text-[13px] transition-colors",
                                    difficulty === d
                                      ? "border-2 border-admin-primary bg-admin-primary-soft font-bold text-admin-primary"
                                      : "border border-admin-line bg-white font-semibold text-admin-muted hover:bg-admin-surface"
                                  )}
                                >
                                  {difficulty === d && <Check className="h-3.5 w-3.5" />}
                                  {d}
                                </button>
                              ))}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-admin-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-admin-primary-hover disabled:pointer-events-none disabled:opacity-40 sm:ml-auto sm:w-auto"
                          >
                            {isGenerating ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Sparkles className="h-4 w-4" />
                            )}
                            {isGenerating ? "Creating…" : `Create ${batchSize} new ${noun}s`}
                          </button>
                        </div>

                        <p className="text-[13px] text-admin-muted">{generateFootnote}</p>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-x-2.5 rounded-2xl border border-admin-line bg-admin-card px-3.5 py-2.5 sm:gap-x-3 sm:px-4 sm:py-3">
                      <p className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-admin-ink sm:gap-2 sm:text-sm">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-admin-success" />
                        <span className="truncate">
                          {noun.charAt(0).toUpperCase() + noun.slice(1)}s created
                        </span>
                      </p>
                      <button
                        type="button"
                        onClick={() => setSetupOpen(true)}
                        className="relative ml-auto h-8 shrink-0 rounded-lg border border-admin-primary px-2.5 text-[12px] font-semibold text-admin-primary transition-colors before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] hover:bg-admin-primary-soft sm:h-11 sm:rounded-xl sm:px-3.5 sm:text-[13px] sm:before:hidden"
                      >
                        Change topic or difficulty
                      </button>
                    </div>
                  )}
                </section>

                {/* Step 2 - pick */}
                {(isGenerating || drafts.length > 0) && (
                  <section className="mb-6">
                    <p className="mb-2.5 flex items-center gap-2 text-[12px] font-bold tracking-wide text-admin-primary uppercase">
                      <span className="flex h-5.5 w-5.5 items-center justify-center rounded-full bg-admin-primary text-[11px] font-bold text-white">
                        2
                      </span>
                      Pick your favourites
                    </p>

                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-base font-bold tracking-tight text-admin-ink">
                        New {noun}s
                      </h3>
                      <span
                        aria-live="polite"
                        className={cn(
                          "rounded-full border px-3.5 py-1.5 text-[13px] font-bold tabular-nums",
                          atCap
                            ? "border-admin-success/25 bg-admin-success-bg text-admin-success"
                            : "border-admin-warning/25 bg-admin-warning-bg text-admin-warning"
                        )}
                      >
                        {selected.size} of {selectionCap} picked
                      </span>
                    </div>

                    <p className="mb-3 text-[13px] text-admin-muted">{pickHelp}</p>

                    {autoPickShown && selected.size > 0 && (
                      <p className="mb-3 rounded-xl border border-admin-primary/20 bg-admin-primary-soft px-4 py-2.5 text-[13px] font-semibold text-admin-primary">
                        We&apos;ve picked {selected.size}{" "} for you - untick one if you&apos;d
                        like a different {noun}.
                      </p>
                    )}

                    {isGenerating ? (
                      <div
                        role="status"
                        aria-live="polite"
                        className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-admin-line bg-admin-card px-4 py-10"
                      >
                        <DfSpinner className="h-12 w-12 sm:h-14 sm:w-14" />
                        <p className="text-[13px] font-semibold text-admin-muted">
                          Creating {batchSize} {noun}s…
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {drafts.map((d, i) => {
                          const isSelected = selected.has(i);
                          const isDuplicate = duplicateIndices.has(i);
                          const isSwapping = swappingIndex === i;
                          const lockedOut = !isSelected && atCap;
                          const song = isSongDraft(d) ? d : null;
                          const picture = isPictureDraft(d) ? d : null;

                          return (
                            <div
                              key={`${i}-${draftIdentity(d).slice(0, 24)}`}
                              role="checkbox"
                              aria-checked={isSelected}
                              aria-label={draftIdentity(d)}
                              tabIndex={0}
                              onClick={() => toggleDraft(i)}
                              onKeyDown={(e) => {
                                if (e.key === " " || e.key === "Enter") {
                                  e.preventDefault();
                                  toggleDraft(i);
                                }
                              }}
                              className={cn(
                                "relative cursor-pointer rounded-2xl border-2 py-4 pr-4 pl-14 transition-all focus-visible:ring-2 focus-visible:ring-admin-gold focus-visible:outline-none sm:pl-15",
                                isSelected
                                  ? "border-admin-primary bg-admin-primary-soft/60"
                                  : "border-admin-line bg-admin-card hover:border-admin-muted/40",
                                lockedOut && "opacity-45"
                              )}
                            >
                              <span
                                className={cn(
                                  "absolute top-4 left-4 flex h-7 w-7 items-center justify-center rounded-lg border-2 transition-colors",
                                  isSelected
                                    ? "border-admin-primary bg-admin-primary text-white"
                                    : "border-admin-muted/40 bg-white text-transparent"
                                )}
                              >
                                <Check className="h-4 w-4" />
                              </span>

                              <span
                                className={cn(
                                  "absolute -top-2.5 right-4 flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-white uppercase",
                                  isSelected ? "bg-admin-primary" : "bg-admin-warning"
                                )}
                              >
                                {isSelected && <Check className="h-3 w-3" />}
                                {isSelected ? "Picked" : "New"}
                              </span>

                              {picture ? (
                                <div className="flex items-start gap-3">
                                  {picture.imageUrl ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img
                                      src={picture.imageUrl}
                                      alt={picture.answer}
                                      className="h-20 w-20 shrink-0 rounded-xl border border-admin-line object-cover sm:h-27.5 sm:w-27.5"
                                    />
                                  ) : (
                                    <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-dashed border-admin-line bg-admin-surface sm:h-27.5 sm:w-27.5">
                                      <ImageIcon className="h-6 w-6 text-admin-muted/50" />
                                    </span>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm leading-relaxed font-semibold text-admin-ink">
                                      Picture card
                                    </p>
                                    <p className="mt-0.5 text-[13px] text-admin-muted">
                                      Guests see this picture and write the answer.
                                    </p>
                                  </div>
                                </div>
                              ) : song ? (
                                <div className="flex items-start gap-3">
                                  <span className="flex h-13 w-13 shrink-0 items-center justify-center rounded-xl border border-admin-line bg-admin-surface">
                                    <Music className="h-5 w-5 text-admin-muted" />
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm leading-relaxed font-semibold text-admin-ink">
                                      {isHigherOrLower ? higherOrLowerQuestion(song) : song.title}
                                    </p>
                                    <p className="mt-0.5 text-[13px] text-admin-muted">
                                      {isHigherOrLower ? song.artist : `${song.artist} · ${song.year}`}
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-sm leading-relaxed font-semibold text-admin-ink">
                                  {isQuestionDraft(d) ? d.question : ""}
                                </p>
                              )}

                              {song?.spotify_track_id && (
                                <div className="mt-3">
                                  <SpotifyPlayer
                                    trackId={song.spotify_track_id}
                                    title={`${song.title} - ${song.artist}`}
                                    compact
                                  />
                                </div>
                              )}

                              {isDuplicate && (
                                <p className="mt-1.5 text-[13px] font-semibold text-admin-error">
                                  Already saved to this round
                                </p>
                              )}

                              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                                <span className="flex flex-wrap items-center gap-2">
                                  {song ? (
                                    <>
                                      <span className="rounded-lg border border-admin-line bg-white px-3 py-1.5 text-[13px] font-semibold text-admin-muted tabular-nums">
                                        {isHigherOrLower ? song.hint_year : song.year}
                                      </span>
                                      {isHigherOrLower && (
                                        <span
                                          className={cn(
                                            "rounded-lg px-3 py-1.5 text-[13px] font-semibold text-admin-primary",
                                            isSelected ? "bg-white" : "bg-admin-primary-soft"
                                          )}
                                        >
                                          Answer: {higherOrLowerAnswer(song)}
                                        </span>
                                      )}
                                    </>
                                  ) : (
                                    <span
                                      className={cn(
                                        "rounded-lg px-3 py-1.5 text-[13px] font-semibold text-admin-primary",
                                        isSelected ? "bg-white" : "bg-admin-primary-soft"
                                      )}
                                    >
                                      Answer:{" "}
                                      {picture
                                        ? picture.answer
                                        : isQuestionDraft(d)
                                          ? d.answer
                                          : ""}
                                    </span>
                                  )}
                                </span>

                                {!isSelected && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSwap(i);
                                    }}
                                    disabled={isApproving || swappingIndex !== null}
                                    title={`Replace with a different ${noun}`}
                                    className="relative flex h-8 shrink-0 items-center gap-1 rounded-lg border border-admin-line bg-white px-2.5 text-[12px] font-semibold text-admin-muted transition-colors before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] hover:bg-admin-surface hover:text-admin-primary disabled:pointer-events-none disabled:opacity-40 sm:h-11 sm:gap-1.5 sm:rounded-xl sm:px-3.5 sm:text-[13px] sm:before:hidden"
                                  >
                                    {isSwapping ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
                                    ) : (
                                      <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                    )}
                                    Swap
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {drafts.length > 0 && !isGenerating && (
                      <div className="mt-4 flex justify-center">
                        <button
                          type="button"
                          onClick={handleGenerate}
                          disabled={isGenerating || isApproving}
                          className="flex h-12 items-center gap-2 rounded-xl border border-admin-line bg-white px-5 text-[13px] font-semibold text-admin-muted transition-colors hover:bg-admin-surface hover:text-admin-primary disabled:pointer-events-none disabled:opacity-40"
                        >
                          <RefreshCw className="h-4 w-4" />
                          Create {batchSize} different {noun}s
                        </button>
                      </div>
                    )}
                  </section>
                )}

                {/* Already saved - on demand only */}
                {savedCount > 0 && (
                  <section className="overflow-hidden rounded-2xl border border-admin-line bg-admin-surface">
                    <button
                      type="button"
                      onClick={() => setSavedOpen((o) => !o)}
                      aria-expanded={savedOpen}
                      aria-controls={savedListId}
                      className="flex min-h-11 w-full items-center gap-2.5 px-4 py-3 text-left"
                    >
                      <Lock className="h-3.5 w-3.5 shrink-0 text-admin-muted" />
                      <span className="shrink-0 rounded-full bg-admin-primary px-2.5 py-0.5 text-[12px] font-bold text-white tabular-nums">
                        {savedCount}
                      </span>
                      <span className="text-sm font-semibold text-admin-ink">
                        Already saved in this round
                      </span>
                      <span className="hidden text-[13px] text-admin-muted sm:inline">
                        - locked, just for reference
                      </span>
                      <ChevronDown
                        className={cn(
                          "ml-auto h-4 w-4 shrink-0 text-admin-muted transition-transform duration-200",
                          savedOpen && "rotate-180"
                        )}
                      />
                    </button>

                    {savedOpen && (
                      <div id={savedListId} className="px-4 pb-2">
                        {savedQuestions.map((q, i) => (
                          <div
                            key={q.id}
                            className="flex items-center gap-3 border-t border-dashed border-admin-line py-2.5"
                          >
                            {kind === "picture" &&
                              (q.image_url ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={q.image_url}
                                  alt={q.answer_text}
                                  className="h-9 w-9 shrink-0 rounded-lg border border-admin-line object-cover"
                                />
                              ) : (
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-admin-line bg-admin-card">
                                  <ImageIcon className="h-4 w-4 text-admin-muted/50" />
                                </span>
                              ))}
                            {kind === "song" && (
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-admin-line bg-admin-card">
                                <Music className="h-4 w-4 text-admin-muted/50" />
                              </span>
                            )}

                            <p className="min-w-0 flex-1 truncate text-[13px] leading-snug text-admin-ink">
                              {q.question_no ?? i + 1}.{" "}
                              {kind === "picture"
                                ? `Picture ${q.question_no ?? i + 1}`
                                : kind === "song"
                                  ? (q.answer_text_ext ?? q.answer_text)
                                  : q.question_text}
                            </p>
                            <p className="shrink-0 text-[13px] font-semibold text-admin-primary tabular-nums">
                              {kind === "song"
                                ? isHigherOrLower
                                  ? q.answer_text
                                  : (q.release_year ?? "")
                                : q.answer_text}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}
              </div>

              {/* ---- Sticky footer */}
              <div className="flex shrink-0 flex-col gap-2.5 border-t border-admin-line bg-admin-surface px-4 py-3 sm:flex-row sm:items-center sm:px-6">
                <p
                  aria-live="polite"
                  className={cn(
                    "min-w-0 flex-1 text-[13px] font-semibold",
                    topicMissing
                      ? "text-admin-warning"
                      : footerReady
                        ? "text-admin-success"
                        : "text-admin-muted"
                  )}
                >
                  {footerReady && !topicMissing && (
                    <Check className="mr-1 inline h-4 w-4 align-text-bottom" />
                  )}
                  {footerStatus}
                </p>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={closeSheet}
                    className="h-12 flex-1 rounded-xl border border-admin-line bg-white px-4 text-sm font-semibold text-admin-muted transition-colors hover:bg-admin-bg sm:flex-none"
                  >
                    Close
                  </button>

                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={isApproving || selected.size === 0}
                    className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-admin-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-admin-primary-hover disabled:pointer-events-none disabled:opacity-40 sm:flex-none"
                  >
                    {isApproving && <Loader2 className="h-4 w-4 animate-spin" />}
                    {selected.size > 0
                      ? `Add ${plural(selected.size, noun)} to round`
                      : `Add ${noun}s to round`}
                  </button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
