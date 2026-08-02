"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { BookOpen, ChevronDown, Sparkles, Edit2, Trash2, Save, Loader2, X, Upload, Target, Printer, Music, ExternalLink, Copy, Check, RefreshCw, MoreVertical } from "lucide-react";
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
} from "@/app/(private)/event-setups/quiz-generator/actions";
import QuizRoundSheet, { type NextRoundSummary } from "./quiz-round-sheet";

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
  playlistUrl?: string | null;
  autoOpen?: boolean;
  // The next round still needing questions, for the sheet's footer. Optional —
  // omit it and the footer just says the quiz is ready.
  nextRound?: NextRoundSummary | null;
};

const printStyles = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #000; }
  .sheet { width: 100%; page-break-inside: avoid; }
  .sheet > *:last-child { margin-bottom: 0; }
  .hdr { margin-bottom: 10px; font-weight: 600; }
  .hdr .fill { display: inline-block; min-width: 280px; border-bottom: 1px solid #000; }
  .label { font-weight: 700; margin: 8px 0 6px; text-align: center; }
  .label .qtext { font-weight: 400; }
  table.grid { width: 100%; border-collapse: collapse; table-layout: fixed; page-break-inside: avoid; }
  table.grid tr, table.grid td { page-break-inside: avoid; }
  table.grid td { width: 33.33%; vertical-align: top; padding: 6px 8px; }
  table.questions { margin-bottom: 22px; }
  table.questions td { border: 1px solid #000; height: 140px; }
  table.answers td { border: none; height: 44px; }
  .qn { font-weight: 700; }
  .imgwrap { margin-top: 6px; text-align: center; }
  .imgwrap img { max-width: 100%; max-height: 108px; object-fit: contain; }
  .answer { margin-top: 16px; height: 1.3em; border-bottom: 1px solid #000; }
  @page { size: A4; margin: 1.2cm; }
`;

export default function CategorySection({ eventId, eventDate, categoryConfigId, category_name, question_count, questions: initialQuestions, orderNo, includeSpotify, isPicture, isHigherLower, playlistUrl: initialPlaylistUrl, autoOpen, nextRound }: Props) {
  const { confirm, ConfirmDialogUI } = useConfirm();
  const [questions, setQuestions] = useState(initialQuestions);

  // Questions are held locally so inline edits feel instant, which means a
  // router.refresh() after approving would otherwise be ignored. Resync when the
  // server sends a different set of rows — keyed on the ids so an unrelated
  // parent re-render doesn't wipe an in-progress edit.
  const initialQuestionIds = initialQuestions.map((q) => q.id).join("|");
  useEffect(() => {
    setQuestions(initialQuestions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestionIds]);

  const isHigherOrLower = includeSpotify && !!isHigherLower;
  const hideQuestionText = !!includeSpotify && !isHigherLower;
  const count = questions.length;
  const isComplete = count >= question_count;
  const hasAny = count > 0;
  const remaining = Math.max(question_count - count, 0);
  const isPastEvent = !!eventDate && eventDate < new Date().toISOString().split("T")[0];
  const [open, setOpen] = useState(!!autoOpen);
  const sectionRef = useRef<HTMLElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(initialPlaylistUrl ?? null);
  const [playlistCopied, setPlaylistCopied] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const configId = categoryConfigId ?? questions.find((q) => q.quiz_category_configs_id != null)?.quiz_category_configs_id ?? null;

  const handleSyncPlaylist = async () => {
    if (configId == null) return;
    setIsSyncing(true);
    try {
      const result = await syncCategoryPlaylistAction(eventId, configId);
      if (result.needsConnect) {
        toast.warning("Reconnect Spotify to build the playlist (new permission needed).");
      } else if (result.ok) {
        if (result.playlistUrl) setPlaylistUrl(result.playlistUrl);
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

  useEffect(() => {
    const hasCookie = document.cookie.includes('spotify_access_token');
    const urlParams = new URLSearchParams(window.location.search);
    if (hasCookie || urlParams.get('spotify_connected') === 'true') {
      setSpotifyConnected(true);
    }
  }, []);
  const [editForm, setEditForm] = useState({ question: "", answer: "", questionNo: 1 });
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const startEditing = (q: Question) => {
    const idx = questions.findIndex(qq => qq.id === q.id);
    setEditingId(q.id);
    setEditForm({ question: q.question_text, answer: q.answer_text, questionNo: q.question_no ?? idx + 1 });
    setNewImageFile(null);
    setNewImagePreview(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({ question: "", answer: "", questionNo: 1 });
    if (newImagePreview) URL.revokeObjectURL(newImagePreview);
    setNewImageFile(null);
    setNewImagePreview(null);
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
      const result = await updatePastQuestionAction(id, isPicture ? null : editForm.question, editForm.answer, imageData, editForm.questionNo, eventId);
      const cacheBust = `?t=${Date.now()}`;
      setQuestions((prev) => {
        const updated = prev.map((q) => q.id === id ? {
          ...q,
          ...(!isPicture ? { question_text: editForm.question } : {}),
          answer_text: editForm.answer,
          question_no: editForm.questionNo,
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
    } catch {
      toast.error("Update failed");
    } finally {
      setIsPending(false);
    }
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

  return (
    <section ref={sectionRef} className="overflow-hidden rounded-2xl border border-admin-line bg-white">
      <div className="flex items-center gap-2 border-b border-admin-line bg-admin-surface px-3 py-2.5 sm:px-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl px-1 text-left transition-colors hover:bg-admin-card/60"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold tracking-tight text-admin-primary sm:text-[15px]">
              {orderNo != null ? `${orderNo}. ` : ''}{category_name}
            </p>
            <p className={cn(
              "mt-0.5 text-[12px] font-medium",
              isComplete ? "text-admin-success" : hasAny ? "text-admin-warning" : "text-admin-muted"
            )}>
              {isComplete ? "Round complete" : hasAny ? `${remaining} question${remaining === 1 ? "" : "s"} still needed` : "Not started"}
            </p>
          </div>
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
            {count} / {question_count}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-admin-muted transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </button>

        {!isPastEvent && !isComplete && (
          // Picture and music-snippet rounds resolve images and Spotify track IDs
          // and lock their topic, so they still run in the full generator. Plain
          // question rounds build in place.
          isPicture || includeSpotify || configId == null ? (
            <Link
              href={`/event-setups/quiz-generator?event_id=${eventId}&category=${encodeURIComponent(category_name)}`}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-admin-primary px-3 text-[12px] font-semibold text-white transition-colors hover:bg-admin-primary-hover sm:px-4 sm:text-[13px]"
            >
              <Sparkles className="h-4 w-4" />
              <span className="sm:hidden">{hasAny ? `Add ${remaining}` : "Start"}</span>
              <span className="hidden sm:inline">{hasAny ? `Add ${remaining} question${remaining === 1 ? "" : "s"}` : "Start round"}</span>
            </Link>
          ) : (
            <QuizRoundSheet
              eventId={eventId}
              categoryConfigId={configId}
              category_name={category_name}
              question_count={question_count}
              savedQuestions={questions}
              orderNo={orderNo}
              nextRound={nextRound}
              onApproved={() => setOpen(true)}
            />
          )
        )}
      </div>

      {open && (
        <>
          {includeSpotify && !spotifyConnected && (
            <div className="px-5 pt-3">
              <a
                href={`/api/spotify/login?return=${encodeURIComponent(`/event-setups/events/${eventId}`)}`}
                style={{ "--spotify-bg": "#1DB954" } as React.CSSProperties}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-(--spotify-bg) font-semibold text-[12px] tracking-wide text-white transition-opacity hover:opacity-90"
              >
                <Music className="h-3.5 w-3.5" />
                Connect Spotify
              </a>
            </div>
          )}
          {includeSpotify && (playlistUrl || spotifyConnected) && (
            <div className="px-5 pt-3">
              {playlistUrl ? (
                spotifyConnected ? (
                  <div className="flex items-center gap-2">
                    <a
                      href={playlistUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ "--spotify-bg": "#1DB954" } as React.CSSProperties}
                      className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-(--spotify-bg) font-semibold text-[12px] tracking-wide text-white transition-opacity hover:opacity-90"
                    >
                      <Music className="h-3.5 w-3.5" />
                      Open Spotify Playlist
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSyncPlaylist}
                      disabled={isSyncing}
                      title="Sync playlist with saved songs"
                      className="h-10 w-10 shrink-0 rounded-xl border-2 border-admin-line text-admin-primary hover:bg-admin-bg"
                    >
                      {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-1.5 rounded-xl border-2 border-admin-line bg-admin-bg p-2.5">
                    <p className="font-bold text-[12px] text-admin-muted">
                      Spotify playlist - copy into a browser or the Spotify app
                    </p>
                    <div className="flex items-center gap-2">
                      <a
                        href={playlistUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-w-0 flex-1 truncate text-[13px] font-bold text-admin-primary underline"
                      >
                        {playlistUrl}
                      </a>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCopyPlaylist}
                        title="Copy playlist URL"
                        className="h-9 w-9 shrink-0 rounded-lg border-2 border-admin-line text-admin-primary hover:bg-white"
                      >
                        {playlistCopied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                )
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSyncPlaylist}
                  disabled={isSyncing || configId == null}
                  className="h-10 w-full rounded-xl border-2 border-admin-line font-bold text-[12px] text-admin-primary hover:bg-admin-bg"
                >
                  {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Music className="mr-2 h-3.5 w-3.5" />}
                  Create Spotify Playlist
                </Button>
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
          <div className="space-y-3 bg-admin-bg p-3">
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
                return (
                  <div key={q.id} className={cn(
                    "relative overflow-hidden rounded-2xl border-2 bg-white p-4 shadow-sm transition-all",
                    isEditing ? "border-admin-primary ring-4 ring-admin-primary/5" : "border-admin-line"
                  )}>
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
                        {isPicture && q.image_url && (
                          <div className="space-y-1.5">
                            <label className="ml-1 text-[13px] font-medium text-admin-muted">Image</label>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={newImagePreview ?? q.image_url}
                              alt={q.answer_text}
                              className="h-40 w-full rounded-xl object-cover"
                            />
                            <label className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-admin-line text-[13px] font-semibold text-admin-muted transition-all hover:border-admin-primary hover:text-admin-primary">
                              <Upload className="h-3.5 w-3.5" />
                              {newImageFile ? newImageFile.name : 'Replace image'}
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
                          <span className="shrink-0 font-bold text-sm text-admin-primary">Question {q.question_no ?? idx + 1}:</span>
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
                                <span className="font-bold italic">{q.answer_text_ext ?? q.answer_text}</span> higher or lower than <span className="font-bold text-orange-600">{q.hint_year}</span>?
                              </p>
                              <div className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#7A1F1F] px-3 py-2 text-white shadow-sm">
                                <Target className="h-3 w-3 shrink-0 text-white/50" />
                                <span className="text-center font-bold text-xs tracking-tight">
                                  {(q.release_year ?? 0) > q.hint_year ? 'Higher' : 'Lower'}
                                </span>
                                <span className="shrink-0 font-bold text-xs text-white/50 tabular-nums">{q.release_year}</span>
                              </div>
                            </div>
                          ) : (
                            <>
                              {q.image_url ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={q.image_url}
                                  alt={q.answer_text}
                                  className="h-40 w-full rounded-xl object-cover"
                                />
                              ) : (
                                (!includeSpotify || !q.spotify_track_id) && (
                                  <p className="text-sm leading-snug font-bold text-admin-ink">
                                    {q.question_text}
                                  </p>
                                )
                              )}
                              {hideQuestionText && q.spotify_track_id && (
                                <SpotifyPlayer trackId={q.spotify_track_id} title={q.answer_text} compact />
                              )}
                              <div className="flex w-full items-center justify-center gap-2 rounded-xl bg-admin-primary px-3 py-2 text-white shadow-sm sm:w-fit sm:min-w-50">
                                <Target className="h-3 w-3 shrink-0 text-white/50" />
                                <span className="text-center font-bold text-xs tracking-tight">{q.answer_text}</span>
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
