"use client";

// Writing a question by hand skips the whole create-then-pick flow: there is
// nothing to curate about a question you have already decided on. So this saves
// straight to the round rather than adding another draft card, and the round's
// counters catch up on the refresh that follows.
//
// The three round shapes need different fields but reuse the generator's save
// actions unchanged, so numbering, audit columns and the playlist sync behave
// exactly as they do for an approved draft.

import React, { useCallback, useId, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2, Pencil, Plus, Search, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  saveQuizToDatabase,
  saveMusicSnippetsAction,
  savePictureRoundAction,
  regeneratePictureImageAction,
  lookupSpotifyTrackAction,
} from "@/app/(private)/event-setups/quiz-generator/actions";
import { SpotifyPlayer } from "@/components/spotify-player";
import { uploadPictureDrafts } from "@/lib/quiz/picture-upload";
import { describeStep, type YearRange } from "@/lib/quiz/higher-lower";
import { roundNoun, type RoundKind } from "@/lib/quiz/round-kind";
import { MANUAL_ORIGIN } from "@/lib/quiz/question-origin";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

interface ManualEntryProps {
  kind: RoundKind;
  isHigherOrLower: boolean;
  eventId: number;
  categoryConfigId: number;
  categoryName: string;
  topic: string;
  imageNotes: string;
  difficulty: string;
  chainStart: number;
  gapRange: YearRange;
  disabled?: boolean;
  /* Set when the round has no room left - what saved plus already-picked adds up
     to. A hand-written entry saves straight to the round, so it has to respect
     the same ceiling the picks do. Null means there is room. */
  blockedReason?: string | null;
  onSaved: () => void;
  onPlaylistUrl?: (url: string) => void;
}

const labelClass = "mb-1.5 block text-[11px] font-bold tracking-wide text-admin-muted uppercase";
const inputClass =
  "h-12 w-full rounded-xl border border-admin-line bg-white px-3.5 text-sm text-admin-ink outline-none placeholder:text-admin-muted/50 focus:border-admin-primary";

export default function ManualEntry({
  kind,
  isHigherOrLower,
  eventId,
  categoryConfigId,
  categoryName,
  topic,
  imageNotes,
  difficulty,
  chainStart,
  gapRange,
  disabled = false,
  blockedReason = null,
  onSaved,
  onPlaylistUrl,
}: ManualEntryProps) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [artist, setArtist] = useState("");
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [trackId, setTrackId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isFinding, setIsFinding] = useState(false);
  const [isMakingPicture, setIsMakingPicture] = useState(false);

  const fieldId = useId();
  const noun = roundNoun(kind);

  const reset = useCallback(() => {
    setQuestion("");
    setAnswer("");
    setArtist("");
    setTitle("");
    setYear("");
    setSpotifyUrl("");
    setTrackId(null);
    setImageUrl(null);
  }, []);

  /* Nothing is added to a song round until Spotify has confirmed the track, so
     the round always has something to play on the night. */
  const handleFind = useCallback(async () => {
    if (isFinding) return;
    if (!spotifyUrl.trim() && !title.trim()) {
      toast.error("Paste a Spotify link, or type the title.");
      return;
    }

    setIsFinding(true);
    try {
      const { track, error } = await lookupSpotifyTrackAction({
        url: spotifyUrl,
        artist,
        title,
      });

      if (error || !track) {
        toast.error(error || "No match on Spotify.");
        return;
      }

      setTrackId(track.trackId);
      setArtist(track.artist);
      setTitle(track.title);
      if (track.year != null) setYear(String(track.year));
      toast.success(`Found ${track.artist} - ${track.title}. Check the details, then add it.`);
    } catch {
      toast.error("Could not reach Spotify.");
    } finally {
      setIsFinding(false);
    }
  }, [isFinding, spotifyUrl, artist, title]);

  const handleFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("That image is over 10MB - pick a smaller one.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImageUrl(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => toast.error("Could not read that image.");
    reader.readAsDataURL(file);
  }, []);

  const handleMakePicture = useCallback(async () => {
    if (isMakingPicture) return;
    if (!answer.trim()) {
      toast.error("Type the answer first - that's what gets pictured.");
      return;
    }
    setIsMakingPicture(true);
    try {
      const { imageUrl: made } = await regeneratePictureImageAction(
        answer.trim(),
        topic,
        imageNotes
      );
      if (!made) {
        toast.error(`No picture came back for "${answer.trim()}" - upload one instead.`);
        return;
      }
      setImageUrl(made);
    } catch {
      toast.error("Could not create that picture.");
    } finally {
      setIsMakingPicture(false);
    }
  }, [isMakingPicture, answer, topic, imageNotes]);

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    // The round can fill up while this stays open - ticking drafts below counts.
    if (blockedReason) {
      toast.error(blockedReason);
      return;
    }

    try {
      if (kind === "question") {
        if (!question.trim() || !answer.trim()) {
          toast.error("A question and an answer are both needed.");
          return;
        }
        setIsSaving(true);
        await saveQuizToDatabase(
          [{ question: question.trim(), answer: answer.trim(), category: categoryName }],
          eventId,
          topic,
          difficulty,
          MANUAL_ORIGIN
        );
      } else if (kind === "song") {
        const parsedYear = parseInt(year, 10);
        if (!trackId) {
          toast.error("Find the song on Spotify first.");
          return;
        }
        if (!artist.trim() || !title.trim()) {
          toast.error("An artist and a title are both needed.");
          return;
        }
        if (!Number.isFinite(parsedYear) || parsedYear < 1900 || parsedYear > new Date().getFullYear() + 1) {
          toast.error("Give the release year as a four-digit year.");
          return;
        }
        if (isHigherOrLower) {
          const reason = describeStep(parsedYear, chainStart, gapRange);
          if (reason) {
            toast.error(reason);
            return;
          }
        }

        setIsSaving(true);
        const result = await saveMusicSnippetsAction(
          [
            {
              artist: artist.trim(),
              title: title.trim(),
              year: parsedYear,
              spotify_track_id: trackId,
            },
          ],
          eventId,
          categoryName,
          categoryConfigId,
          topic,
          difficulty,
          chainStart,
          MANUAL_ORIGIN
        );

        if (result?.skipped) {
          toast.error("That song didn't follow on from the one before it, so it wasn't added.");
          return;
        }
        if (result?.playlistUrl) onPlaylistUrl?.(result.playlistUrl);
      } else {
        if (!topic.trim()) {
          toast.error("A picture round needs its topic before anything can be added.");
          return;
        }
        if (!answer.trim()) {
          toast.error("Type what the picture is of.");
          return;
        }
        if (!imageUrl) {
          toast.error("Upload a picture, or create one.");
          return;
        }

        setIsSaving(true);
        const uploaded = await uploadPictureDrafts([{ answer: answer.trim(), imageUrl }], eventId);
        await savePictureRoundAction(
          uploaded,
          eventId,
          categoryName,
          categoryConfigId,
          topic.trim(),
          difficulty,
          MANUAL_ORIGIN
        );
      }

      toast.success(`Your ${noun} was added to the round.`);
      reset();
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Could not add that ${noun}.`);
    } finally {
      setIsSaving(false);
    }
  }, [
    isSaving,
    kind,
    question,
    answer,
    artist,
    title,
    year,
    trackId,
    imageUrl,
    isHigherOrLower,
    chainStart,
    gapRange,
    eventId,
    categoryConfigId,
    categoryName,
    topic,
    difficulty,
    noun,
    reset,
    blockedReason,
    onSaved,
    onPlaylistUrl,
  ]);

  if (!open) {
    return (
      <button
        type="button"
        /* Deliberately clickable when the round is full: an error that says why
           beats a dead button that says nothing. */
        onClick={() => {
          if (blockedReason) {
            toast.error(blockedReason);
            return;
          }
          setOpen(true);
        }}
        disabled={disabled}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-admin-primary bg-white px-4 text-[13px] font-semibold text-admin-primary transition-colors hover:bg-admin-primary-soft disabled:pointer-events-none disabled:opacity-40"
      >
        <Pencil className="h-4 w-4" />
        Write your own {noun}
      </button>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-admin-line bg-admin-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold tracking-tight text-admin-ink">Write your own {noun}</p>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            reset();
          }}
          aria-label="Close manual entry"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-admin-line text-admin-muted transition-colors hover:bg-admin-surface"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {kind === "question" && (
        <>
          <div>
            <label htmlFor={`${fieldId}-question`} className={labelClass}>
              Question
            </label>
            <textarea
              id={`${fieldId}-question`}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={2}
              placeholder="e.g. Which river runs through Bristol?"
              disabled={isSaving}
              className="w-full resize-none rounded-xl border border-admin-line bg-white px-3.5 py-3 text-sm text-admin-ink outline-none placeholder:text-admin-muted/50 focus:border-admin-primary"
            />
          </div>
          <div>
            <label htmlFor={`${fieldId}-answer`} className={labelClass}>
              Answer
            </label>
            <input
              id={`${fieldId}-answer`}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="e.g. The Avon"
              disabled={isSaving}
              className={inputClass}
            />
          </div>
        </>
      )}

      {kind === "song" && (
        <>
          <div>
            <label htmlFor={`${fieldId}-spotify`} className={labelClass}>
              Spotify link{" "}
              <span className="font-medium normal-case">
                - paste one, or type the title below and we&apos;ll find it
              </span>
            </label>
            <input
              id={`${fieldId}-spotify`}
              value={spotifyUrl}
              onChange={(e) => setSpotifyUrl(e.target.value)}
              placeholder="https://open.spotify.com/track/…"
              disabled={isSaving || isFinding}
              className={inputClass}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${fieldId}-artist`} className={labelClass}>
                Artist
              </label>
              <input
                id={`${fieldId}-artist`}
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="e.g. The Shadows"
                disabled={isSaving}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor={`${fieldId}-title`} className={labelClass}>
                Title
              </label>
              <input
                id={`${fieldId}-title`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Apache"
                disabled={isSaving}
                className={inputClass}
              />
            </div>
          </div>
          <div className="sm:max-w-45">
            <label htmlFor={`${fieldId}-year`} className={labelClass}>
              Release year
            </label>
            <input
              id={`${fieldId}-year`}
              type="number"
              min={1900}
              max={new Date().getFullYear() + 1}
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="1960"
              disabled={isSaving}
              className={inputClass}
            />
          </div>
          {trackId ? (
            <div className="space-y-2">
              <SpotifyPlayer trackId={trackId} title={`${artist} - ${title}`} compact />
              <p className="text-[13px] text-admin-muted">
                Play it to check it&apos;s the right recording. Artist, title and year came from
                Spotify - edit any of them if you&apos;d rather they read differently on the night.
                {isHigherOrLower &&
                  ` This one is compared against ${chainStart}, so its year has to be ${gapRange.minYears}-${gapRange.maxYears} years away from it.`}
              </p>
            </div>
          ) : (
            <p className="text-[13px] text-admin-muted">
              Find the song on Spotify before adding it, so the round has something to play.
              {isHigherOrLower &&
                ` Its year also has to be ${gapRange.minYears}-${gapRange.maxYears} years away from ${chainStart}.`}
            </p>
          )}
        </>
      )}

      {kind === "picture" && (
        <>
          <div>
            <label htmlFor={`${fieldId}-answer`} className={labelClass}>
              Answer - what the picture is of
            </label>
            <input
              id={`${fieldId}-answer`}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="e.g. Border Collie"
              disabled={isSaving}
              className={inputClass}
            />
          </div>

          <div className="flex items-start gap-3">
            {imageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={imageUrl}
                alt={answer || "Picture round card"}
                className="h-20 w-20 shrink-0 rounded-xl border border-admin-line object-cover sm:h-27.5 sm:w-27.5"
              />
            ) : (
              <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-dashed border-admin-line bg-admin-surface sm:h-27.5 sm:w-27.5">
                <ImagePlus className="h-6 w-6 text-admin-muted/50" />
              </span>
            )}

            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <label htmlFor={`${fieldId}-file`} className={labelClass}>
                  Upload a picture
                </label>
                <input
                  id={`${fieldId}-file`}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                  disabled={isSaving}
                  className="w-full text-[13px] text-admin-muted file:mr-3 file:h-9 file:rounded-lg file:border file:border-admin-line file:bg-white file:px-3 file:text-[13px] file:font-semibold file:text-admin-ink"
                />
              </div>

              <button
                type="button"
                onClick={handleMakePicture}
                disabled={isSaving || isMakingPicture}
                className="flex h-11 items-center justify-center gap-2 rounded-xl border border-admin-primary bg-white px-4 text-[13px] font-semibold text-admin-primary transition-colors hover:bg-admin-primary-soft disabled:pointer-events-none disabled:opacity-40"
              >
                {isMakingPicture ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {isMakingPicture ? "Creating…" : "Or create one for this answer"}
              </button>
            </div>
          </div>
        </>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {kind === "song" && !trackId ? (
          <button
            type="button"
            onClick={handleFind}
            disabled={isFinding}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-admin-primary px-5 text-[13px] font-semibold text-white transition-colors hover:bg-admin-primary-hover disabled:pointer-events-none disabled:opacity-40 sm:w-auto"
          >
            {isFinding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {isFinding ? "Searching…" : "Find song on Spotify"}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className={cn(
                "flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-admin-primary px-5 text-[13px] font-semibold text-white transition-colors hover:bg-admin-primary-hover disabled:pointer-events-none disabled:opacity-40 sm:w-auto"
              )}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {isSaving ? "Adding…" : "Add to round"}
            </button>

            {kind === "song" && (
              <button
                type="button"
                onClick={handleFind}
                disabled={isSaving || isFinding}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-admin-line bg-white px-5 text-[13px] font-semibold text-admin-muted transition-colors hover:bg-admin-surface disabled:pointer-events-none disabled:opacity-40 sm:w-auto"
              >
                {isFinding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                {isFinding ? "Searching…" : "Find a different song"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
