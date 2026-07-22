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

export default function CategorySection({ eventId, eventDate, categoryConfigId, category_name, question_count, questions: initialQuestions, orderNo, includeSpotify, isPicture, isHigherLower, playlistUrl: initialPlaylistUrl, autoOpen }: Props) {
  const { confirm, ConfirmDialogUI } = useConfirm();
  const [questions, setQuestions] = useState(initialQuestions);
  const isHigherOrLower = includeSpotify && !!isHigherLower;
  const hideQuestionText = !!includeSpotify && !isHigherLower;
  const count = questions.length;
  const isComplete = count >= question_count;
  const hasAny = count > 0;
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
    const currentQ = questions.find((q) => q.id === id);
    if (editForm.questionNo !== (currentQ?.question_no ?? 0)) {
      const duplicate = questions.find((q) => q.id !== id && q.question_no === editForm.questionNo);
      if (duplicate) {
        toast.error(`Q${editForm.questionNo} is already taken`);
        return;
      }
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
        const currentNo = prev.find(q => q.id === id)?.question_no;
        if (currentNo === editForm.questionNo) return updated;
        const others = updated.filter(q => q.id !== id);
        const editedQ = updated.find(q => q.id === id)!;
        const clamped = Math.max(1, Math.min(editForm.questionNo, prev.length));
        others.splice(clamped - 1, 0, editedQ);
        return others.map((q, i) => ({ ...q, question_no: i + 1 }));
      });
      toast.success("Question updated");
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
    const ok = await confirm({
      title: "Delete question",
      description: "Delete this question? This cannot be undone.",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    setIsPending(true);
    try {
      await deletePastQuestionAction(id);
      setQuestions((prev) => prev.filter((q) => q.id !== id));
      toast.success("Question deleted");
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
      toast.info("Sheet fits a 3×3 grid — printing the first 9 questions");
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
    win.document.write(`<!DOCTYPE html><html><head><title>${escapeHtml(category_name)} — Quiz Sheet</title>
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
    <section ref={sectionRef} className="overflow-hidden rounded-2xl border border-[#E6DFC8] bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between border-b border-[#D6CDAE] bg-[#E6DFC8] px-5 py-3.5 text-left transition-colors hover:bg-[#DDD4B8]"
      >
        <p className="font-black text-xs tracking-wide text-[#5C4033] uppercase">
          {orderNo != null ? `${orderNo}. ` : ''}{category_name}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              "rounded-lg border px-2.5 py-1 font-black text-[10px] tabular-nums",
              isComplete
                ? "border-green-200 bg-green-50 text-green-700"
                : hasAny
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-[#E6DFC8] bg-[#F7F4EA] text-[#5F624F]"
            )}
          >
            {count} / {question_count}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-[#5F624F] transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </div>
      </button>

      {open && (
        <>
          {includeSpotify && !spotifyConnected && (
            <div className="px-5 pt-3">
              <a
                href={`/api/spotify/login?return=${encodeURIComponent(`/event-setups/events/${eventId}`)}`}
                style={{ "--spotify-bg": "#1DB954" } as React.CSSProperties}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-(--spotify-bg) font-black text-[10px] tracking-wide text-white uppercase transition-opacity hover:opacity-90"
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
                      className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-(--spotify-bg) font-black text-[10px] tracking-wide text-white uppercase transition-opacity hover:opacity-90"
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
                      className="h-10 w-10 shrink-0 rounded-xl border-2 border-[#E6DFC8] text-[#5C4033] hover:bg-[#F7F4EA]"
                    >
                      {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-1.5 rounded-xl border-2 border-[#E6DFC8] bg-[#F7F4EA] p-2.5">
                    <p className="font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
                      Spotify playlist — copy into a browser or the Spotify app
                    </p>
                    <div className="flex items-center gap-2">
                      <a
                        href={playlistUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-w-0 flex-1 truncate text-[11px] font-bold text-[#5C4033] underline"
                      >
                        {playlistUrl}
                      </a>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCopyPlaylist}
                        title="Copy playlist URL"
                        className="h-9 w-9 shrink-0 rounded-lg border-2 border-[#E6DFC8] text-[#5C4033] hover:bg-white"
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
                  className="h-10 w-full rounded-xl border-2 border-[#E6DFC8] font-black text-[10px] tracking-wide text-[#5C4033] uppercase hover:bg-[#F7F4EA]"
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
                className="h-10 w-full rounded-xl border-2 border-[#E6DFC8] bg-slate-100 font-black text-[10px] tracking-wide text-[#5C4033] uppercase hover:bg-[#F7F4EA]"
              >
                <Printer className="mr-2 h-3.5 w-3.5" />
                Print Picture Sheet
              </Button>
            </div>
          )}
          {isPicture && (() => {
            const firstQ = questions.find((q) => q.question_text);
            return firstQ ? (
              <div className="border-b border-[#E6DFC8] bg-[#5C4033]/5 px-5 py-2.5">
                <p className="pl-3 font-black text-sm text-[#5C4033]">
                  Question: <span className="font-bold text-[#1F1F1A]">{firstQ.question_text}</span>
                </p>
              </div>
            ) : null;
          })()}
          <div className="space-y-3 bg-amber-50 p-3">
            {count === 0 ? (
              <div className="py-8 text-center">
                <BookOpen className="mx-auto mb-2 h-6 w-6 text-[#5F624F] opacity-20" />
                <p className="font-black text-xs tracking-wide text-[#5F624F] uppercase opacity-40">
                  No questions yet
                </p>
              </div>
            ) : (
              questions.map((q, idx) => {
                const isEditing = editingId === q.id;
                return (
                  <div key={q.id} className={cn(
                    "relative overflow-hidden rounded-2xl border-2 bg-white p-4 shadow-sm transition-all",
                    isEditing ? "border-[#5C4033] ring-4 ring-[#5C4033]/5" : "border-[#E6DFC8]"
                  )}>
                    {isEditing ? (
                      <div className="animate-in space-y-3 duration-200 zoom-in-95 fade-in">
                        <div className="flex items-center gap-2">
                          <label className="ml-1 font-black text-xs tracking-wide text-[#5F624F] uppercase">Question No.</label>
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
                            className="h-10 w-16 rounded-lg border border-[#E6DFC8] bg-white px-3 py-2 text-center font-black text-xs text-[#5C4033] tabular-nums outline-none focus:border-[#5C4033]"
                          />
                        </div>
                        {isPicture && q.image_url && (
                          <div className="space-y-1.5">
                            <label className="ml-1 font-black text-xs tracking-wide text-[#5F624F] uppercase">Image</label>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={newImagePreview ?? q.image_url}
                              alt={q.answer_text}
                              className="h-40 w-full rounded-xl object-cover"
                            />
                            <label className="flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#E6DFC8] font-black text-xs tracking-wide text-[#5F624F] uppercase transition-all hover:border-[#5C4033] hover:text-[#5C4033]">
                              <Upload className="h-3.5 w-3.5" />
                              {newImageFile ? newImageFile.name : 'Replace image'}
                              <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                            </label>
                          </div>
                        )}
                        {!isPicture && !hideQuestionText && (
                          <div className="space-y-1.5">
                            <label className="ml-1 font-black text-xs tracking-wide text-[#5F624F] uppercase">Question</label>
                            <textarea
                              title="Edit question"
                              value={editForm.question}
                              onChange={(e) => setEditForm({ ...editForm, question: e.target.value })}
                              className="min-h-30 w-full resize-none rounded-xl border-2 border-[#E6DFC8] bg-[#F7F4EA]/30 p-3 text-xs leading-relaxed outline-none focus:border-[#5C4033]"
                            />
                          </div>
                        )}
                        <div className="space-y-1.5">
                          <label className="ml-1 font-black text-xs tracking-wide text-[#5F624F] uppercase">Answer</label>
                          <input
                            title="Edit answer"
                            value={editForm.answer}
                            onChange={(e) => setEditForm({ ...editForm, answer: e.target.value })}
                            className="h-11 w-full rounded-xl border-2 border-[#5C4033]/15 bg-[#5C4033]/10 px-3 font-black text-xs text-[#5C4033] outline-none focus:border-[#5C4033]"
                          />
                        </div>
                        <div className="flex gap-2 pt-1">
                          <Button
                            onClick={() => saveEdit(q.id)}
                            disabled={isPending}
                            className="h-10 flex-1 rounded-xl bg-[#1B4332] font-black text-xs tracking-wide text-white uppercase hover:bg-[#1B4332]/85"
                          >
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-2 h-3.5 w-3.5" /> Save</>}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={cancelEditing}
                            disabled={isPending}
                            className="h-10 rounded-xl border-2 border-[#E6DFC8] bg-red-500 px-4 text-xs font-bold text-white uppercase"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="-mt-1 flex items-center justify-between gap-2">
                          <span className="shrink-0 font-black text-sm text-[#5C4033]">Question {q.question_no ?? idx + 1}:</span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Question actions"
                                aria-label="Question actions"
                                className="-mr-1 h-7 w-7 shrink-0 rounded-xl text-[#5F624F] hover:bg-[#5C4033]/5 hover:text-[#5C4033]"
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
                              <p className="text-sm leading-snug text-[#1F1F1A]">
                                <span className="font-bold italic">{q.answer_text_ext ?? q.answer_text}</span> higher or lower than <span className="font-bold text-orange-600">{q.hint_year}</span>?
                              </p>
                              <div className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#7A1F1F] px-3 py-2 text-white shadow-sm">
                                <Target className="h-3 w-3 shrink-0 text-white/50" />
                                <span className="text-center font-black text-xs tracking-tight">
                                  {(q.release_year ?? 0) > q.hint_year ? 'Higher' : 'Lower'}
                                </span>
                                <span className="shrink-0 font-black text-xs text-white/50 tabular-nums">{q.release_year}</span>
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
                                  <p className="text-sm leading-snug font-bold text-[#1F1F1A]">
                                    {q.question_text}
                                  </p>
                                )
                              )}
                              {hideQuestionText && q.spotify_track_id && (
                                <SpotifyPlayer trackId={q.spotify_track_id} title={q.answer_text} compact />
                              )}
                              <div className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1B4332] px-3 py-2 text-white shadow-sm sm:w-fit sm:min-w-50">
                                <Target className="h-3 w-3 shrink-0 text-white/50" />
                                <span className="text-center font-black text-xs tracking-tight">{q.answer_text}</span>
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

          {!isPastEvent && (
            <div className="border-t border-[#E6DFC8] bg-[#F7F4EA]/50 px-5 py-3.5">
              <Link
                href={`/event-setups/quiz-generator?event_id=${eventId}&category=${encodeURIComponent(category_name)}`}
                className={cn(
                  "flex h-10 w-full items-center justify-center gap-2 rounded-xl font-black text-[11px] tracking-wide uppercase transition-all",
                  isComplete
                    ? "border border-[#E6DFC8] bg-white text-[#5F624F] hover:bg-[#F7F4EA]"
                    : "bg-[#9A3412] text-white shadow-sm hover:bg-[#9A3412]/50"
                )}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {isComplete ? "Generate Extra" : "Generate Questions"}
              </Link>
            </div>
          )}
        </>
      )}
      {ConfirmDialogUI}
    </section>
  );
}
