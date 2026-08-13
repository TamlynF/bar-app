"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Brain, ChevronDown, Gauge, Sparkles, Plus, Edit2, Trash2, Save, Loader2, X, Upload, Target, Printer, Music, ImageIcon, ExternalLink, Copy, Check, RefreshCw, MoreVertical, GripVertical, LogOut, CalendarDays } from "lucide-react";
import { SiSpotify } from "react-icons/si";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { SpotifyPlayer } from "@/components/spotify-player";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import {
  updatePastQuestionAction,
  deletePastQuestionAction,
  syncCategoryPlaylistAction,
  lookupSpotifyTrackAction,
  reorderCategoryQuestionsAction,
  copyCategoryPlaylistAction,
  disconnectSpotifyAction,
} from "@/app/(private)/event-setups/quiz-generator/actions";
import QuizRoundSheet, { type NextRoundSummary } from "./quiz-round-sheet";
import { describeStep, stepDirection, DEFAULT_YEAR_RANGE } from "@/lib/quiz/higher-lower";
import { moveQuestion, orderChanged, dropIndex } from "@/lib/quiz/question-order";

type Question = {
  id: string;
  question_text: string;
  answer_text: string;
  answer_text_ext?: string | null;
  quiz_category_configs_id: number | null;
  question_no?: number | null;
  spotify_track_id?: string | null;
  hint_year?: number | null;
  release_year?: number | null;
  image_url?: string | null;
  difficulty?: string | null;
};

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

const notOwnerMessage = (owner?: string | null) =>
  `That playlist was made on ${owner ?? "another"}${owner ? "'s" : ""} Spotify account, so only they can change it. You can still open and play it.`;

const difficultyTone = (difficulty: string) => {
  const value = difficulty.toLowerCase();
  if (value === "easy") return "border-admin-success/25 bg-admin-success-bg text-admin-success";
  if (value === "hard") return "border-admin-error/25 bg-admin-error-bg text-admin-error";
  return "border-admin-warning/25 bg-admin-warning-bg text-admin-warning";
};

type Props = {
  eventId: number;
  eventDate?: string;
  categoryConfigId?: number;
  category_name: string;
  question_count: number;
  questions: Question[];
  orderNo?: number;
  includeSpotify?: boolean;
  isPicture?: boolean;
  isHigherLower?: boolean;
  minYears?: number;
  maxYears?: number;
  playlistUrl?: string | null;
  // False when the playlist shown is a colleague's, or a shared one from before
  // per-user playlists - you can open it, but only its owner can change it.
  playlistIsMine?: boolean;
  playlistOwnerName?: string | null;
  autoOpen?: boolean;
  // Set by "Continue building quiz" - lands on the round with its sheet open.
  openSheet?: boolean;
  // The next round still needing questions, for the sheet's footer. Optional -
  // omit it and the footer just says the quiz is ready.
  nextRound?: NextRoundSummary | null;
};

const printStyles = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #000; }
  /* The inset lives on the sheet, not on @page, so the grid keeps clear of the
     paper edge even when the print dialog is set to "Margins: None". */
  .sheet { width: 100%; padding: 14mm 12mm; page-break-inside: avoid; }
  .sheet > *:last-child { margin-bottom: 0; }
  .hdr { margin-bottom: 10px; font-weight: 600; }
  .hdr .fill { display: inline-block; min-width: 280px; border-bottom: 1px solid #000; }
  .label { font-weight: 700; margin: 8px 0 6px; text-align: center; }
  .label .qtext { font-weight: 400; }
  table.grid { width: 100%; border-collapse: collapse; table-layout: fixed; page-break-inside: avoid; }
  table.grid tr, table.grid td { page-break-inside: avoid; }
  table.grid td { width: 33.33%; vertical-align: top; padding: 6px 8px; }
  table.questions { margin-bottom: 22px; }
  table.questions td { border: 1px solid #000; height: 132px; }
  table.answers td { border: none; height: 44px; }
  .qn { font-weight: 700; }
  .imgwrap { margin-top: 6px; text-align: center; }
  .imgwrap img { max-width: 100%; max-height: 100px; object-fit: contain; }
  .answer { margin-top: 16px; height: 1.3em; border-bottom: 1px solid #000; }
  @page { size: A4; margin: 0; }
`;

export default function CategorySection({ eventId, eventDate, categoryConfigId, category_name, question_count, questions: initialQuestions, orderNo, includeSpotify, isPicture, isHigherLower, minYears, maxYears, playlistUrl: initialPlaylistUrl, playlistIsMine = false, playlistOwnerName = null, autoOpen, openSheet, nextRound }: Props) {
  const router = useRouter();
  const { confirm, ConfirmDialogUI } = useConfirm();
  const [questions, setQuestions] = useState(initialQuestions);

  // Questions are held locally so inline edits feel instant, which means a
  // router.refresh() after approving would otherwise be ignored. Resync when the
  // server sends a different set of rows - keyed on the ids so an unrelated
  // parent re-render doesn't wipe an in-progress edit.
  const initialQuestionIds = initialQuestions.map((q) => q.id).join("|");
  useEffect(() => {
    setQuestions(initialQuestions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestionIds]);

  const isHigherOrLower = includeSpotify && !!isHigherLower;
  const hideQuestionText = !!includeSpotify && !isHigherLower;
  const gapRange = {
    minYears: minYears ?? DEFAULT_YEAR_RANGE.minYears,
    maxYears: maxYears ?? DEFAULT_YEAR_RANGE.maxYears,
  };
  const RoundIcon = isPicture ? ImageIcon : includeSpotify ? Music : Brain;
  const count = questions.length;
  const isComplete = count >= question_count;
  const hasAny = count > 0;
  const remaining = Math.max(question_count - count, 0);
  const isPastEvent = !!eventDate && eventDate < new Date().toISOString().split("T")[0];
  const [open, setOpen] = useState(!!autoOpen);
  const sectionRef = useRef<HTMLElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifyAccount, setSpotifyAccount] = useState<string | null>(null);
  const [spotifyRefreshKey, setSpotifyRefreshKey] = useState(0);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(initialPlaylistUrl ?? null);
  const [playlistCopied, setPlaylistCopied] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  /* Whose playlist the round is currently showing. It starts from the server -
     which knows from the employee_id on the row, no Spotify call needed - and
     only changes once this person makes a copy of their own. */
  const [isMyPlaylist, setIsMyPlaylist] = useState(playlistIsMine);
  const [playlistOwner, setPlaylistOwner] = useState<string | null>(
    playlistIsMine ? null : playlistOwnerName
  );

  const configId = categoryConfigId ?? questions.find((q) => q.quiz_category_configs_id != null)?.quiz_category_configs_id ?? null;

  const someoneElsesPlaylist = !!playlistUrl && !isMyPlaylist;

  const handleCopyPlaylistToMine = async () => {
    if (configId == null || isCopying) return;

    const ok = await confirm({
      title: "Make your own copy of this playlist?",
      description: `A new playlist is created on your Spotify with ${category_name}'s songs in question order, and becomes the one you see and sync here. ${
        playlistOwner ? `${playlistOwner}'s` : "The existing"
      } playlist is left exactly as it is - they keep seeing and syncing theirs, and you keep yours.`,
      confirmLabel: "Create my copy",
    });
    if (!ok) return;

    setIsCopying(true);
    try {
      const result = await copyCategoryPlaylistAction(eventId, configId);
      if (result.ok && result.playlistUrl) {
        setPlaylistUrl(result.playlistUrl);
        setPlaylistOwner(null);
        setIsMyPlaylist(true);
        toast.success("Copied - this round now syncs to the playlist on your Spotify");
      } else if (result.needsConnect) {
        toast.warning("Connect Spotify first, then copy the playlist.");
      } else if (result.error === "no_songs") {
        toast.error("This round has no songs to copy yet.");
      } else if (result.error === "no_employee_record") {
        toast.error("Your login isn't linked to a staff record, so the copy can't be saved to you.");
      } else {
        toast.error("Could not copy the playlist");
      }
    } catch {
      toast.error("Could not copy the playlist");
    } finally {
      setIsCopying(false);
    }
  };

  const handleSyncPlaylist = async () => {
    if (configId == null) return;
    setIsSyncing(true);
    try {
      const result = await syncCategoryPlaylistAction(eventId, configId);
      if (result.error === "not_owner") {
        setPlaylistOwner(result.ownerName ?? null);
        setIsMyPlaylist(false);
        toast.warning(notOwnerMessage(result.ownerName));
      } else if (result.needsConnect) {
        toast.warning("Reconnect Spotify to build the playlist (new permission needed).");
      } else if (result.ok) {
        if (result.playlistUrl) setPlaylistUrl(result.playlistUrl);
        setPlaylistOwner(null);
        setIsMyPlaylist(true);
        toast.success("Playlist synced");
      } else {
        toast.error("Could not sync the playlist");
      }
    } catch {
      toast.error("Could not sync the playlist");
    } finally {
      setIsSyncing(false);
    }
  };

  /* Connecting leaves the app and comes back, so the return trip names this round
     - the page reopens and scrolls to it rather than dumping you at the top. */
  const spotifyReturnPath = `/event-setups/events/${eventId}?category=${encodeURIComponent(category_name)}`;
  const spotifyLoginHref = `/api/spotify/login?return=${encodeURIComponent(spotifyReturnPath)}`;

  const handleDisconnectSpotify = async () => {
    if (isDisconnecting) return;
    const ok = await confirm({
      title: "Disconnect Spotify?",
      description: `This signs ${spotifyAccount ?? "the connected account"} out of the quiz app so you can connect a different one. Playlists already made stay exactly where they are, on whichever account made them.`,
      confirmLabel: "Disconnect",
    });
    if (!ok) return;

    setIsDisconnecting(true);
    try {
      await disconnectSpotifyAction();
      setSpotifyConnected(false);
      setSpotifyAccount(null);
      setSpotifyRefreshKey((k) => k + 1);
      toast.success("Spotify disconnected - connect again to use a different account");
    } catch {
      toast.error("Could not disconnect Spotify");
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleCopyPlaylist = () => {
    if (!playlistUrl) return;
    navigator.clipboard.writeText(playlistUrl);
    setPlaylistCopied(true);
    setTimeout(() => setPlaylistCopied(false), 2000);
  };

  useEffect(() => {
    if (autoOpen && sectionRef.current) {
      setTimeout(() => {
        sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, [autoOpen]);

  /* The account cookie outlives the access token, so it - not the hour-long
     token - is what says whether Spotify is still connected. The return trip's
     flag is dropped from the URL once read, so a later disconnect isn't undone
     by a stale query string. */
  useEffect(() => {
    const account = readCookie("spotify_account");
    const params = new URLSearchParams(window.location.search);
    const justConnected = params.get("spotify_connected") === "true";
    if (justConnected) {
      params.delete("spotify_connected");
      const query = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
    }
    if (account !== null || justConnected || document.cookie.includes("spotify_access_token")) {
      setSpotifyConnected(true);
      setSpotifyAccount(account || null);
    }
  }, [spotifyRefreshKey]);
  const [editForm, setEditForm] = useState({ question: "", answer: "", questionNo: 1, releaseYear: "" });
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  // The order as it stood when the drag began, so a failed save can put it back.
  const dragSnapshot = useRef<Question[] | null>(null);
  const [editTrackId, setEditTrackId] = useState<string | null>(null);
  const [editSpotifyUrl, setEditSpotifyUrl] = useState("");
  const [isFindingTrack, setIsFindingTrack] = useState(false);

  const startEditing = (q: Question) => {
    const idx = questions.findIndex(qq => qq.id === q.id);
    setEditingId(q.id);
    setEditForm({
      question: q.question_text,
      answer: q.answer_text,
      questionNo: q.question_no ?? idx + 1,
      releaseYear: q.release_year != null ? String(q.release_year) : "",
    });
    setNewImageFile(null);
    setNewImagePreview(null);
    setEditTrackId(q.spotify_track_id ?? null);
    setEditSpotifyUrl("");
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({ question: "", answer: "", questionNo: 1, releaseYear: "" });
    if (newImagePreview) URL.revokeObjectURL(newImagePreview);
    setNewImageFile(null);
    setNewImagePreview(null);
    setEditTrackId(null);
    setEditSpotifyUrl("");
  };

  /* The player below the field is the check: swap the link, hear what the round
     will actually play, then save. */
  const findEditTrack = async (q: Question) => {
    if (isFindingTrack) return;
    const fallbackQuery = q.answer_text_ext ?? editForm.answer ?? q.answer_text;
    if (!editSpotifyUrl.trim() && !fallbackQuery.trim()) {
      toast.error("Paste a Spotify link first.");
      return;
    }

    setIsFindingTrack(true);
    try {
      const { track, error } = await lookupSpotifyTrackAction({
        url: editSpotifyUrl,
        title: editSpotifyUrl.trim() ? undefined : fallbackQuery,
      });
      if (error || !track) {
        toast.error(error || "No match on Spotify.");
        return;
      }
      setEditTrackId(track.trackId);
      toast.success(`Found ${track.artist} - ${track.title}. Play it, then save.`);
    } catch {
      toast.error("Could not reach Spotify.");
    } finally {
      setIsFindingTrack(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (newImagePreview) URL.revokeObjectURL(newImagePreview);
    setNewImageFile(file);
    setNewImagePreview(URL.createObjectURL(file));
  };

  const saveEdit = async (id: string) => {
    if ((!isPicture && !hideQuestionText && !editForm.question) || !editForm.answer) {
      toast.error("Fields cannot be empty");
      return;
    }
    if (!editForm.questionNo || editForm.questionNo < 1) {
      toast.error("Question number is required");
      return;
    }
    if (editForm.questionNo > questions.length) {
      toast.error(
        `${category_name} has ${questions.length} question${questions.length === 1 ? "" : "s"}, so the number must be between 1 and ${questions.length}.`
      );
      return;
    }
    if (includeSpotify && editForm.releaseYear.trim()) {
      const year = parseInt(editForm.releaseYear, 10);
      if (!Number.isFinite(year) || year < 1900 || year > new Date().getFullYear() + 1) {
        toast.error(`Release year must be between 1900 and ${new Date().getFullYear() + 1}.`);
        return;
      }
    }
    const currentQ = questions.find((q) => q.id === id);
    const currentNo = currentQ?.question_no ?? 0;
    const numberChanged = editForm.questionNo !== currentNo;
    const swapWith = numberChanged
      ? questions.find((q) => q.id !== id && q.question_no === editForm.questionNo)
      : undefined;

    if (numberChanged) {
      const ok = await confirm({
        title: `Move to question ${editForm.questionNo}?`,
        description: swapWith
          ? `Question ${currentNo} will become question ${editForm.questionNo} in ${category_name}. Question ${editForm.questionNo} is already taken, so that question will swap places and become question ${currentNo}.`
          : `Question ${currentNo} will become question ${editForm.questionNo} in ${category_name}.`,
        confirmLabel: "Save changes",
      });
      if (!ok) return;
    }

    setIsPending(true);
    try {
      let imageData: { base64: string; mimeType: string; oldImageUrl: string | null } | null = null;
      if (isPicture && newImageFile) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(newImageFile);
        });
        const currentQ = questions.find((q) => q.id === id);
        imageData = { base64, mimeType: newImageFile.type, oldImageUrl: currentQ?.image_url ?? null };
      }
      const trackChanged = !!includeSpotify && editTrackId !== (currentQ?.spotify_track_id ?? null);
      const trimmedYear = editForm.releaseYear.trim();
      const nextYear = trimmedYear === "" ? null : parseInt(trimmedYear, 10);
      const yearChanged = !!includeSpotify && nextYear !== (currentQ?.release_year ?? null);
      const result = await updatePastQuestionAction(
        id,
        isPicture ? null : editForm.question,
        editForm.answer,
        imageData,
        editForm.questionNo,
        eventId,
        trackChanged ? editTrackId : undefined,
        yearChanged ? nextYear : undefined
      );
      const cacheBust = `?t=${Date.now()}`;
      setQuestions((prev) => {
        const updated = prev.map((q) => q.id === id ? {
          ...q,
          ...(!isPicture ? { question_text: editForm.question } : {}),
          answer_text: editForm.answer,
          question_no: editForm.questionNo,
          ...(trackChanged ? { spotify_track_id: editTrackId } : {}),
          ...(yearChanged ? { release_year: nextYear } : {}),
          ...(result.image_url != null ? { image_url: result.image_url.split("?")[0] + cacheBust } : result.image_url === null ? { image_url: null } : {}),
        } : q);
        if (!numberChanged) return updated;
        /* Mirror the server-side swap so the list matches without a refetch. */
        const swapped = swapWith
          ? updated.map((q) => (q.id === swapWith.id ? { ...q, question_no: currentNo } : q))
          : updated;
        return [...swapped].sort((a, b) => (a.question_no ?? 0) - (b.question_no ?? 0));
      });
      toast.success(
        swapWith
          ? `Saved. Questions ${currentNo} and ${editForm.questionNo} swapped places.`
          : "Question updated"
      );
      setEditingId(null);
      if (newImagePreview) URL.revokeObjectURL(newImagePreview);
      setNewImageFile(null);
      setNewImagePreview(null);
      setEditTrackId(null);
      setEditSpotifyUrl("");
      if (trackChanged && configId != null) {
        syncCategoryPlaylistAction(eventId, configId).catch(() => {});
      }
      /* On a Higher-or-Lower round the year is what every later question is
         measured against, so the server rebuilds the chain - pull it back. */
      if (yearChanged && isHigherOrLower) router.refresh();
    } catch {
      toast.error("Update failed");
    } finally {
      setIsPending(false);
    }
  };

  /* Reordering rewrites question_no on every row that moved, and on a
     Higher-or-Lower round it also rebuilds the chain of comparison years - so the
     round is pulled back from the server once the write lands. */
  const persistOrder = useCallback(async (ordered: Question[], snapshot: Question[]) => {
    if (configId == null) {
      setQuestions(snapshot);
      toast.error("This round has no category set up, so it cannot be reordered.");
      return;
    }

    setIsReordering(true);
    try {
      const { playlist } = await reorderCategoryQuestionsAction(
        eventId,
        configId,
        ordered.map((q) => q.id)
      );

      if (playlist?.status === "synced") {
        toast.success("Question order updated - the Spotify playlist now plays in the same order");
      } else if (playlist?.status === "not_owner") {
        setPlaylistOwner(playlist.ownerName ?? null);
        toast.warning(`Question order updated. ${notOwnerMessage(playlist.ownerName)}`);
      } else if (playlist?.status === "needs_connect") {
        toast.warning("Question order updated. Connect Spotify to re-order the playlist to match.");
      } else if (playlist?.status === "failed") {
        toast.warning("Question order updated, but the Spotify playlist could not be re-ordered.");
      } else {
        toast.success("Question order updated");
      }

      if (isHigherOrLower) router.refresh();
    } catch {
      setQuestions(snapshot);
      toast.error("Could not save the new order");
    } finally {
      setIsReordering(false);
    }
  }, [configId, eventId, isHigherOrLower, router]);

  /* The handle stays enabled while a reorder saves - disabling it would take the
     focus away mid-keystroke - so the in-flight guard lives in the handlers. */
  const reorderAllowed = questions.length > 1 && editingId === null && !isPending;
  const canReorder = reorderAllowed && !isReordering;

  const startDrag = (e: React.PointerEvent<HTMLButtonElement>, id: string) => {
    if (!canReorder) return;
    // preventDefault stops the drag selecting the card text, so focus has to be
    // asked for - it is what the arrow keys act on once the drag is over.
    e.preventDefault();
    e.currentTarget.focus();
    dragSnapshot.current = questions;
    setDraggingId(id);
  };

  /* The drag is followed on the window rather than through setPointerCapture on
     the handle. Reordering moves the handle's card in the DOM, and moving a
     capturing element makes the browser drop the capture - the rest of the
     gesture, pointerup included, would then never reach the handler and the new
     order would be shown but never saved.

     Re-registering as `questions` changes is what keeps the listeners reading
     the order as it stands rather than the one the drag started from. */
  useEffect(() => {
    if (!draggingId) return;

    const onMove = (e: PointerEvent) => {
      const from = questions.findIndex((q) => q.id === draggingId);
      if (from < 0) return;

      // Midpoints of the cards that are staying put - the index the dragged card
      // would land on, and what makes a card swap at halfway rather than at its edge.
      const midpoints = questions
        .filter((q) => q.id !== draggingId)
        .map((q) => {
          const rect = cardRefs.current.get(q.id)?.getBoundingClientRect();
          return rect ? rect.top + rect.height / 2 : Number.POSITIVE_INFINITY;
        });

      const to = dropIndex(midpoints, e.clientY);
      if (to !== from) setQuestions((prev) => moveQuestion(prev, from, to));
    };

    const onEnd = () => {
      setDraggingId(null);
      const snapshot = dragSnapshot.current;
      dragSnapshot.current = null;
      if (snapshot && orderChanged(snapshot, questions)) {
        persistOrder(questions, snapshot);
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
    };
  }, [draggingId, questions, persistOrder]);

  /* Dragging is a pointer gesture, so the handle also answers to the arrow keys -
     otherwise a round could only be reordered with a mouse or a finger. */
  const moveByKeyboard = (id: string, delta: number) => {
    if (!canReorder) return;
    const from = questions.findIndex((q) => q.id === id);
    if (from < 0) return;
    const to = from + delta;
    if (to < 0 || to >= questions.length) return;

    const snapshot = questions;
    const reordered = moveQuestion(questions, from, to);
    setQuestions(reordered);
    persistOrder(reordered, snapshot);
  };

  const deleteQuestion = async (id: string) => {
    const target = questions.find((q) => q.id === id);
    const targetNo = target?.question_no ?? questions.findIndex((q) => q.id === id) + 1;
    const willRenumber = questions.some((q) => (q.question_no ?? 0) > targetNo);

    const ok = await confirm({
      title: "Delete question",
      description: willRenumber
        ? `Are you sure you want to delete ${category_name} question number ${targetNo} from this quiz? The questions after it will be renumbered so they still run from 1. This cannot be undone.`
        : `Are you sure you want to delete ${category_name} question number ${targetNo} from this quiz? This cannot be undone.`,
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    setIsPending(true);
    try {
      await deletePastQuestionAction(id);
      setQuestions((prev) =>
        prev
          .filter((q) => q.id !== id)
          .sort((a, b) => (a.question_no ?? 0) - (b.question_no ?? 0))
          .map((q, i) => ({ ...q, question_no: i + 1 }))
      );
      toast.success(willRenumber ? "Question deleted and the rest renumbered" : "Question deleted");
      if (includeSpotify && configId != null) {
        syncCategoryPlaylistAction(eventId, configId).catch(() => {});
      }
    } catch {
      toast.error("Delete failed");
    } finally {
      setIsPending(false);
    }
  };

  const handlePrintPictureSheet = () => {
    const escapeHtml = (s: string) =>
      s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

    const sorted = [...questions].sort((a, b) => (a.question_no ?? 0) - (b.question_no ?? 0));
    const firstQ = questions.find((q) => q.question_text)?.question_text ?? "";
    const cols = 3;
    const total = 9; // fixed 3×3 grid to match the Word layout / fit one page
    if (sorted.length > total) {
      toast.info("Sheet fits a 3×3 grid - printing the first 9 questions");
    }
    const cells = Array.from({ length: total }, (_, i) => {
      const q = sorted[i];
      return { no: q?.question_no ?? i + 1, img: q?.image_url ?? "" };
    });

    const buildRows = (render: (c: { no: number; img: string }) => string) => {
      let html = "";
      for (let r = 0; r < cells.length; r += cols) {
        const row = cells.slice(r, r + cols);
        html += `<tr>${row.map(render).join("")}</tr>`;
      }
      return html;
    };

    const questionRows = buildRows((c) => `
      <td>
        <span class="qn">Q${c.no}</span>
        ${c.img ? `<div class="imgwrap"><img src="${escapeHtml(c.img)}" alt="" /></div>` : ""}
      </td>`);

    const answerRows = buildRows((c) => `
      <td>
        <span class="qn">Q${c.no}:</span>
        <div class="answer"></div>
      </td>`);

    const win = window.open("", "_blank", "width=900,height=1200");
    if (!win) {
      toast.error("Allow pop-ups to print the sheet");
      return;
    }
    win.document.write(`<!DOCTYPE html><html><head><title>${escapeHtml(category_name)} - Quiz Sheet</title>
      <style>${printStyles}</style></head>
      <body>
        <div class="sheet">
          <div class="hdr">Team Name:&nbsp;<span class="fill"></span></div>
          <p class="label">Question: <span class="qtext">${escapeHtml(firstQ)}</span></p>
          <table class="grid questions"><tbody>${questionRows}</tbody></table>
          <p class="label">Answers:</p>
          <table class="grid answers"><tbody>${answerRows}</tbody></table>
        </div>
        <script>
          window.onload = function () { window.focus(); window.print(); };
          window.onafterprint = function () { window.close(); };
        </script>
      </body></html>`);
    win.document.close();
  };

  /* The playlist is public and the link is shared by the round, not by whoever
     made it - so opening it never depends on having your own Spotify connected.
     Only syncing does. */
  const playlistLinkRow = playlistUrl ? (
    <div className="flex items-center gap-2">
      <a
        href={playlistUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{ "--spotify-bg": "#1DB954" } as React.CSSProperties}
        className="flex h-9 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg bg-(--spotify-bg) text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
      >
        <Music className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">Open Spotify Playlist</span>
        <ExternalLink className="h-3 w-3 shrink-0" />
      </a>
      <Button
        type="button"
        variant="outline"
        onClick={handleCopyPlaylist}
        title="Copy playlist link"
        aria-label="Copy playlist link"
        className="h-9 w-9 shrink-0 rounded-lg border border-admin-line bg-white text-admin-primary hover:bg-admin-bg"
      >
        {playlistCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
      </Button>
      {spotifyConnected && !someoneElsesPlaylist && (
        <Button
          type="button"
          variant="outline"
          onClick={handleSyncPlaylist}
          disabled={isSyncing}
          title="Sync playlist with saved songs"
          aria-label="Sync playlist with saved songs"
          className="h-9 w-9 shrink-0 rounded-lg border border-admin-line bg-white text-admin-primary hover:bg-admin-bg"
        >
          {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      )}
    </div>
  ) : null;

  return (
    <section ref={sectionRef} data-category-section className="overflow-hidden rounded-2xl border border-admin-line bg-white">
      {/* Four fixed rails, same order and width on every row: name + status,
          progress chip, action slot, chevron. Complete rounds fill the action
          slot with a tag rather than collapsing it. */}
      <div className="flex flex-nowrap items-center gap-2 border-b border-admin-line bg-admin-surface px-2 py-2.5 sm:flex-wrap sm:gap-3 sm:px-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-h-11 min-w-0 flex-1 basis-auto items-center gap-2.5 rounded-xl px-1 text-left transition-colors hover:bg-admin-card/60 sm:basis-full md:basis-auto"
        >
          <RoundIcon className="h-4 w-4 shrink-0 text-admin-muted" />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-bold tracking-tight text-admin-primary sm:truncate sm:text-[15px]">
              {orderNo != null ? `${orderNo}. ` : ''}{category_name}
            </p>
            <p className={cn(
              "mt-0.5 text-[12px] font-medium tabular-nums",
              isComplete ? "text-admin-success" : hasAny ? "text-admin-warning" : "text-admin-muted"
            )}>
              <span className="sm:hidden">{count} / {question_count}</span>
              <span className="hidden sm:inline">
                {isComplete ? "Round complete" : hasAny ? `${remaining} more needed` : "Not started"}
              </span>
            </p>
          </div>
        </button>

        <span
          className={cn(
            "hidden w-18.5 shrink-0 rounded-lg border py-2 text-center text-[13px] font-semibold tabular-nums sm:block",
            isComplete
              ? "border-admin-success/25 bg-admin-success-bg text-admin-success"
              : hasAny
              ? "border-admin-warning/25 bg-admin-warning-bg text-admin-warning"
              : "border-admin-line bg-admin-card text-admin-muted"
          )}
        >
          {count} / {question_count}
        </span>

        <div className="flex w-11 flex-none sm:w-auto sm:flex-1 md:w-47.5 md:flex-none">
          {isComplete ? (
            <span
              title="Round complete"
              className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-admin-success/40 text-[13px] font-semibold text-admin-success"
            >
              <Check className="h-4 w-4" />
              <span className="hidden sm:inline">Complete</span>
            </span>
          ) : isPastEvent ? null : configId == null ? (
            <Link
              href={`/event-setups/quiz-generator?event_id=${eventId}&category=${encodeURIComponent(category_name)}`}
              aria-label={hasAny ? `Add ${remaining} more` : "Start round"}
              title={hasAny ? `Add ${remaining} more` : "Start round"}
              className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-1.5 rounded-xl bg-admin-primary text-[13px] font-semibold text-white transition-colors hover:bg-admin-primary-hover sm:px-3"
            >
              <Plus className="h-4 w-4 shrink-0 sm:hidden" />
              <Sparkles className="hidden h-4 w-4 shrink-0 sm:block" />
              <span className="hidden sm:inline">{hasAny ? `Add ${remaining} more` : "Start round"}</span>
            </Link>
          ) : (
            <QuizRoundSheet
              eventId={eventId}
              categoryConfigId={configId}
              category_name={category_name}
              question_count={question_count}
              savedQuestions={questions}
              orderNo={orderNo}
              includeSpotify={includeSpotify}
              isPicture={isPicture}
              isHigherLower={isHigherLower}
              minYears={minYears}
              maxYears={maxYears}
              playlistUrl={playlistUrl}
              spotifyConnected={spotifyConnected}
              spotifyAccount={spotifyAccount}
              spotifyReturnPath={spotifyReturnPath}
              autoOpen={openSheet}
              nextRound={nextRound}
              onApproved={() => setOpen(true)}
              onPlaylistUrl={setPlaylistUrl}
            />
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? "Hide saved questions" : "Show saved questions"}
          title={open ? "Hide saved questions" : "Show saved questions"}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-admin-line bg-white text-admin-muted transition-colors hover:bg-admin-primary-soft hover:text-admin-primary"
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </button>
      </div>

      {open && (
        <>
          {includeSpotify && (
            <div className="space-y-2 px-3 pt-3 pb-3 sm:px-5">
              {spotifyConnected ? (
                <div className="space-y-2 rounded-xl border border-admin-line bg-admin-surface px-2.5 py-2.5 sm:px-3">
                  <div className="flex items-center gap-2">
                    <span
                      style={{ "--spotify-bg": "#1DB954" } as React.CSSProperties}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-(--spotify-bg) text-white"
                    >
                      <SiSpotify className="h-4 w-4" />
                    </span>
                    <p className="min-w-0 flex-1 text-[13px] leading-snug text-admin-muted">
                      Connected as{" "}
                      <span className="font-semibold break-all text-admin-ink">
                        {spotifyAccount ?? "your Spotify account"}
                      </span>
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleDisconnectSpotify}
                      disabled={isDisconnecting}
                      title="Disconnect Spotify"
                      aria-label="Disconnect Spotify"
                      className="h-9 w-9 shrink-0 rounded-lg border border-admin-line bg-white p-0 text-[13px] font-semibold text-admin-muted hover:bg-admin-card hover:text-admin-ink sm:w-auto sm:px-3"
                    >
                      {isDisconnecting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin sm:mr-1.5" />
                      ) : (
                        <LogOut className="h-3.5 w-3.5 sm:mr-1.5" />
                      )}
                      <span className="hidden sm:inline">Disconnect</span>
                    </Button>
                  </div>
                  {playlistLinkRow ?? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSyncPlaylist}
                      disabled={isSyncing || configId == null}
                      className="h-9 w-full rounded-lg border border-admin-line bg-white text-[13px] font-semibold text-admin-primary hover:bg-admin-bg"
                    >
                      {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Music className="mr-2 h-3.5 w-3.5" />}
                      Create Spotify Playlist
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <a
                    href={spotifyLoginHref}
                    style={{ "--spotify-bg": "#1DB954" } as React.CSSProperties}
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-(--spotify-bg) font-semibold text-[12px] tracking-wide text-white transition-opacity hover:opacity-90"
                  >
                    <Music className="h-3.5 w-3.5" />
                    Connect Spotify
                  </a>
                  {playlistLinkRow}
                </>
              )}
              {someoneElsesPlaylist && (
                <div className="space-y-2 rounded-xl border border-admin-line bg-admin-surface p-2.5">
                  <p className="text-[13px] text-admin-muted">
                    {playlistOwner
                      ? `This is ${playlistOwner}'s playlist.`
                      : "This playlist was made before everyone had their own."}{" "}
                    You can open and play it, but only its owner can change it. Make your own
                    copy to get one this round keeps in step for you - theirs stays as it is.
                  </p>
                  {spotifyConnected && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCopyPlaylistToMine}
                      disabled={isCopying}
                      className="h-10 w-full rounded-xl border border-admin-primary text-[13px] font-semibold text-admin-primary hover:bg-admin-primary-soft"
                    >
                      {isCopying ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Copy className="mr-2 h-4 w-4" />
                      )}
                      Make my own copy
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
          {isPicture && count > 0 && (
            <div className="px-5 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={handlePrintPictureSheet}
                className="h-10 w-full rounded-xl border-2 border-admin-line bg-slate-100 font-semibold text-[12px] tracking-wide text-admin-primary hover:bg-admin-bg"
              >
                <Printer className="mr-2 h-3.5 w-3.5" />
                Print Picture Sheet
              </Button>
            </div>
          )}
          {isPicture && (() => {
            const firstQ = questions.find((q) => q.question_text);
            return firstQ ? (
              <div className="border-b border-admin-line bg-admin-primary/5 px-5 py-2.5">
                <p className="pl-3 font-bold text-sm text-admin-primary">
                  Question: <span className="font-bold text-admin-ink">{firstQ.question_text}</span>
                </p>
              </div>
            ) : null;
          })()}
          <div className={cn("space-y-3 bg-admin-bg p-3", draggingId && "select-none")}>
            {count > 1 && (
              <p className="flex items-center gap-1.5 px-1 text-[13px] text-admin-muted">
                {isReordering ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                    Saving the new order…
                  </>
                ) : (
                  <>
                    <GripVertical className="h-3.5 w-3.5 shrink-0" />
                    Drag a question by its handle to reorder the round - the numbers follow.
                  </>
                )}
              </p>
            )}
            {count === 0 ? (
              <div className="py-8 text-center">
                <BookOpen className="mx-auto mb-2 h-6 w-6 text-admin-muted opacity-20" />
                <p className="font-bold text-xs text-admin-muted opacity-40">
                  No questions yet
                </p>
              </div>
            ) : (
              questions.map((q, idx) => {
                const isEditing = editingId === q.id;
                const chainWarning =
                  isHigherOrLower && q.hint_year
                    ? describeStep(q.release_year, q.hint_year, gapRange)
                    : null;
                const isDragging = draggingId === q.id;
                return (
                  <div
                    key={q.id}
                    ref={(el) => {
                      if (el) cardRefs.current.set(q.id, el);
                      else cardRefs.current.delete(q.id);
                    }}
                    className={cn(
                      "relative overflow-hidden rounded-2xl border-2 bg-white p-4 shadow-sm transition-all",
                      isEditing ? "border-admin-primary ring-4 ring-admin-primary/5" : "border-admin-line",
                      isDragging && "border-admin-primary shadow-lg ring-2 ring-admin-primary/20",
                      draggingId !== null && !isDragging && "opacity-60"
                    )}
                  >
                    {isEditing ? (
                      <div className="animate-in space-y-3 duration-200 zoom-in-95 fade-in">
                        <div className="flex items-center gap-2">
                          <label className="ml-1 text-[13px] font-medium text-admin-muted">Question No.</label>
                          <input
                            type="number"
                            inputMode="numeric"
                            title="Question number"
                            min={1}
                            max={questions.length}
                            value={editForm.questionNo || ''}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '');
                              setEditForm({ ...editForm, questionNo: val === '' ? 0 : parseInt(val) });
                            }}
                            className="h-11 w-18 rounded-lg border border-admin-line bg-white px-3 py-2 text-center text-base font-semibold text-admin-primary tabular-nums outline-none focus:border-admin-primary sm:text-sm"
                          />
                        </div>
                        {isPicture && (
                          <div className="space-y-1.5">
                            <label className="ml-1 text-[13px] font-medium text-admin-muted">Image</label>
                            {newImagePreview ?? q.image_url ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={newImagePreview ?? q.image_url ?? ""}
                                alt={q.answer_text}
                                className="h-40 w-full rounded-xl object-cover sm:h-56 sm:w-auto sm:max-w-full sm:object-contain"
                              />
                            ) : (
                              <div className="flex h-40 w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-admin-error/40 bg-admin-error-bg sm:h-56">
                                <ImageIcon className="h-6 w-6 text-admin-error/50" />
                                <p className="text-[13px] font-semibold text-admin-error">
                                  This question has no image
                                </p>
                              </div>
                            )}
                            <label className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-admin-line text-[13px] font-semibold text-admin-muted transition-all hover:border-admin-primary hover:text-admin-primary">
                              <Upload className="h-3.5 w-3.5" />
                              {newImageFile ? newImageFile.name : q.image_url ? 'Replace image' : 'Upload an image'}
                              <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                            </label>
                          </div>
                        )}
                        {!isPicture && !hideQuestionText && (
                          <div className="space-y-1.5">
                            <label className="ml-1 text-[13px] font-medium text-admin-muted">Question</label>
                            <textarea
                              title="Edit question"
                              value={editForm.question}
                              onChange={(e) => setEditForm({ ...editForm, question: e.target.value })}
                              className="min-h-30 w-full resize-none rounded-xl border-2 border-admin-line bg-admin-bg/30 p-3 text-base leading-relaxed text-admin-ink outline-none focus:border-admin-primary sm:text-sm"
                            />
                          </div>
                        )}
                        <div className="space-y-1.5">
                          <label className="ml-1 text-[13px] font-medium text-admin-muted">Answer</label>
                          <input
                            title="Edit answer"
                            value={editForm.answer}
                            onChange={(e) => setEditForm({ ...editForm, answer: e.target.value })}
                            className="h-11 w-full rounded-xl border-2 border-admin-primary/15 bg-admin-primary/10 px-3 text-base font-semibold text-admin-primary outline-none focus:border-admin-primary sm:text-sm"
                          />
                        </div>
                        {includeSpotify && (
                          <div className="space-y-1.5">
                            <label
                              htmlFor={`release-year-${q.id}`}
                              className="ml-1 text-[13px] font-medium text-admin-muted"
                            >
                              Release year
                            </label>
                            <input
                              id={`release-year-${q.id}`}
                              type="number"
                              inputMode="numeric"
                              min={1900}
                              max={new Date().getFullYear() + 1}
                              placeholder="e.g. 1982"
                              value={editForm.releaseYear}
                              onChange={(e) =>
                                setEditForm({ ...editForm, releaseYear: e.target.value.replace(/\D/g, "") })
                              }
                              disabled={isPending}
                              className="h-11 w-28 rounded-xl border-2 border-admin-line bg-admin-bg/30 px-3 text-base font-semibold text-admin-ink tabular-nums outline-none placeholder:font-normal placeholder:text-admin-muted/50 focus:border-admin-primary sm:text-sm"
                            />
                            {isHigherOrLower && (
                              <p className="text-[13px] text-admin-muted">
                                This is the answer on a Higher or Lower round - changing it
                                re-measures every question after this one.
                              </p>
                            )}
                          </div>
                        )}
                        {includeSpotify && (
                          <div className="space-y-1.5">
                            <label
                              htmlFor={`spotify-url-${q.id}`}
                              className="ml-1 text-[13px] font-medium text-admin-muted"
                            >
                              Spotify link
                            </label>
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <input
                                id={`spotify-url-${q.id}`}
                                value={editSpotifyUrl}
                                onChange={(e) => setEditSpotifyUrl(e.target.value)}
                                placeholder="https://open.spotify.com/track/…"
                                disabled={isPending || isFindingTrack}
                                className="h-11 w-full min-w-0 flex-1 rounded-xl border-2 border-admin-line bg-admin-bg/30 px-3 text-base text-admin-ink outline-none placeholder:text-admin-muted/50 focus:border-admin-primary sm:text-sm"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => findEditTrack(q)}
                                disabled={isPending || isFindingTrack}
                                className="h-11 shrink-0 rounded-xl border border-admin-primary bg-white px-4 text-[13px] font-semibold text-admin-primary hover:bg-admin-primary-soft"
                              >
                                {isFindingTrack ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Music className="mr-2 h-4 w-4" />
                                )}
                                {isFindingTrack ? "Searching…" : "Find song"}
                              </Button>
                            </div>
                            {editTrackId ? (
                              <SpotifyPlayer
                                trackId={editTrackId}
                                title={editForm.answer || q.answer_text}
                                compact
                              />
                            ) : (
                              <p className="text-[13px] text-admin-muted">
                                This question has no song yet - paste a link, or search on the
                                answer above.
                              </p>
                            )}
                          </div>
                        )}
                        <div className="flex gap-2 pt-1">
                          <Button
                            onClick={() => saveEdit(q.id)}
                            disabled={isPending}
                            className="h-11 flex-1 rounded-xl bg-admin-primary text-[13px] font-semibold text-white hover:bg-admin-primary-hover"
                          >
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-2 h-4 w-4" /> Save</>}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={cancelEditing}
                            disabled={isPending}
                            className="h-11 shrink-0 rounded-xl border border-admin-line bg-admin-card px-5 text-[13px] font-semibold text-admin-muted hover:bg-admin-surface hover:text-admin-ink"
                          >
                            <X className="mr-2 h-4 w-4" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="-mt-1 flex items-center justify-between gap-2">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            {questions.length > 1 && (
                              <button
                                type="button"
                                aria-label={`Reorder question ${q.question_no ?? idx + 1} - drag, or use the arrow keys`}
                                title="Drag to reorder"
                                disabled={!reorderAllowed && !isDragging}
                                onPointerDown={(e) => startDrag(e, q.id)}
                                onKeyDown={(e) => {
                                  if (e.key === "ArrowUp") {
                                    e.preventDefault();
                                    moveByKeyboard(q.id, -1);
                                  } else if (e.key === "ArrowDown") {
                                    e.preventDefault();
                                    moveByKeyboard(q.id, 1);
                                  }
                                }}
                                className={cn(
                                  "-ml-1.5 flex h-8 w-6 shrink-0 touch-none items-center justify-center rounded-lg text-admin-muted transition-colors select-none hover:bg-admin-primary/5 hover:text-admin-primary focus-visible:ring-2 focus-visible:ring-admin-gold focus-visible:outline-none disabled:pointer-events-none disabled:opacity-30",
                                  isDragging ? "cursor-grabbing text-admin-primary" : "cursor-grab"
                                )}
                              >
                                <GripVertical className="h-4 w-4" />
                              </button>
                            )}
                            <span className="shrink-0 font-bold text-sm text-admin-primary">Question {q.question_no ?? idx + 1}:</span>
                            {q.difficulty && (
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold",
                                  difficultyTone(q.difficulty)
                                )}
                              >
                                <Gauge className="h-3 w-3 shrink-0" />
                                {q.difficulty}
                              </span>
                            )}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Question actions"
                                aria-label="Question actions"
                                className="-mr-1 h-7 w-7 shrink-0 rounded-xl text-admin-muted hover:bg-admin-primary/5 hover:text-admin-primary"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-36">
                              <DropdownMenuItem onClick={() => startEditing(q)}>
                                <Edit2 className="h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                disabled={isPending}
                                onClick={() => deleteQuestion(q.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="space-y-3">
                          {isHigherOrLower && q.hint_year ? (
                            <div className="space-y-2">
                              <p className="text-sm leading-snug text-admin-ink">
                                <span className="font-bold italic">{q.answer_text_ext ?? q.answer_text}</span> higher or lower than <span className="font-bold text-admin-warning">{q.hint_year}</span>?
                              </p>
                              <div className="flex w-full items-center justify-center gap-2 rounded-xl bg-admin-primary px-3 py-2 text-white shadow-sm">
                                <Target className="h-3 w-3 shrink-0 text-white/50" />
                                <span className="text-center font-bold text-xs tracking-tight">
                                  {stepDirection(q.release_year ?? 0, q.hint_year)}
                                </span>
                                <span className="shrink-0 font-bold text-xs text-white/50 tabular-nums">{q.release_year}</span>
                              </div>
                              {/* Deleting a question re-links the chain but cannot
                                  find a new song, so a gap can end up outside the
                                  round's range. Say so rather than bend it. */}
                              {chainWarning && (
                                <p className="text-[13px] font-semibold text-admin-warning">
                                  {chainWarning}
                                </p>
                              )}
                            </div>
                          ) : (
                            <>
                              {q.image_url ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={q.image_url}
                                  alt={q.answer_text}
                                  className="h-40 w-full rounded-xl object-cover sm:h-56 sm:w-auto sm:max-w-full sm:object-contain"
                                />
                              ) : isPicture ? (
                                <div className="flex h-40 w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-admin-error/40 bg-admin-error-bg sm:h-56">
                                  <ImageIcon className="h-6 w-6 text-admin-error/50" />
                                  <p className="text-[13px] font-semibold text-admin-error">
                                    No image - edit this question to upload one
                                  </p>
                                </div>
                              ) : (
                                (!includeSpotify || !q.spotify_track_id) && (
                                  <p className="text-sm leading-snug text-admin-ink">
                                    {q.question_text}
                                  </p>
                                )
                              )}
                              {hideQuestionText && q.spotify_track_id && (
                                <SpotifyPlayer trackId={q.spotify_track_id} title={q.answer_text} compact />
                              )}
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="flex w-full items-center justify-center gap-2 rounded-xl bg-admin-primary px-3 py-2 text-white shadow-sm sm:w-fit sm:min-w-50">
                                  <Target className="h-3 w-3 shrink-0 text-white/50" />
                                  <span className="text-center font-bold text-xs tracking-tight">{q.answer_text}</span>
                                </div>
                                {includeSpotify && q.release_year != null && (
                                  <span
                                    title="Release year"
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-admin-line bg-white px-3 py-2 font-bold text-xs text-admin-primary tabular-nums"
                                  >
                                    <CalendarDays className="h-3 w-3 shrink-0 text-admin-muted" />
                                    {q.release_year}
                                  </span>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                        {includeSpotify && q.spotify_track_id && !hideQuestionText && (
                          <SpotifyPlayer trackId={q.spotify_track_id} title={q.answer_text_ext ?? q.answer_text} compact />
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

        </>
      )}
      {ConfirmDialogUI}
    </section>
  );
}
