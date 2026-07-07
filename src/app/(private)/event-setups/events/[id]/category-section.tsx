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
  // Spotify (non higher/lower) rounds answer by the track itself — no question text to edit.
  const hideQuestionText = !!includeSpotify && !isHigherLower;
  const count = questions.length;
  const isComplete = count >= question_count;
  const hasAny = count > 0;
  // Past events are read-only for question generation — hide the Generate button
  // once the event date has passed (dates are YYYY-MM-DD strings).
  const isPastEvent = !!eventDate && eventDate < new Date().toISOString().split("T")[0];
  const [open, setOpen] = useState(!!autoOpen);
  const sectionRef = useRef<HTMLElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(initialPlaylistUrl ?? null);
  const [playlistCopied, setPlaylistCopied] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Resolve the category config id (prop, or fall back to a saved question's).
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

  // Detect existing Spotify connection (cookie set by the OAuth callback, or the
  // return redirect flag) so the connect prompt only shows when needed.
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
        // Re-sort: remove edited, splice at new position, renumber
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
      // Keep the Spotify playlist in sync after removing a song (best-effort).
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
    // Always render exactly 9 slots; fill from the questions, leave the rest blank.
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
    <section ref={sectionRef} className="bg-white border border-[#E6DFC8] rounded-2xl overflow-hidden">
      {/* Category header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-[#E6DFC8] hover:bg-[#DDD4B8] border-b border-[#D6CDAE] transition-colors text-left"
      >
        <p className="text-xs font-black uppercase tracking-wide text-[#5C4033]">
          {orderNo != null ? `${orderNo}. ` : ''}{category_name}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={cn(
              "text-[10px] font-black tabular-nums px-2.5 py-1 rounded-lg border",
              isComplete
                ? "bg-green-50 border-green-200 text-green-700"
                : hasAny
                ? "bg-amber-50 border-amber-200 text-amber-700"
                : "bg-[#F7F4EA] border-[#E6DFC8] text-[#5F624F]"
            )}
          >
            {count} / {question_count}
          </span>
          <ChevronDown
            className={cn(
              "w-4 h-4 text-[#5F624F] transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </div>
      </button>

      {/* Questions body */}
      {open && (
        <>
          {includeSpotify && !spotifyConnected && (
            <div className="px-5 pt-3">
              <a
                href={`/api/spotify/login?return=${encodeURIComponent(`/event-setups/events/${eventId}`)}`}
                style={{ "--spotify-bg": "#1DB954" } as React.CSSProperties}
                className="flex items-center justify-center gap-2 w-full h-10 rounded-xl bg-(--spotify-bg) text-white font-black uppercase text-[10px] tracking-wide hover:opacity-90 transition-opacity"
              >
                <Music className="w-3.5 h-3.5" />
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
                      className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl bg-(--spotify-bg) text-white font-black uppercase text-[10px] tracking-wide hover:opacity-90 transition-opacity"
                    >
                      <Music className="w-3.5 h-3.5" />
                      Open Spotify Playlist
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSyncPlaylist}
                      disabled={isSyncing}
                      title="Sync playlist with saved songs"
                      className="h-10 w-10 rounded-xl border-2 border-[#E6DFC8] text-[#5C4033] hover:bg-[#F7F4EA] shrink-0"
                    >
                      {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-xl border-2 border-[#E6DFC8] bg-[#F7F4EA] p-2.5 space-y-1.5">
                    <p className="text-[10px] font-black uppercase tracking-wide text-[#5F624F]">
                      Spotify playlist — copy into a browser or the Spotify app
                    </p>
                    <div className="flex items-center gap-2">
                      <a
                        href={playlistUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 min-w-0 truncate text-[11px] font-bold text-[#5C4033] underline"
                      >
                        {playlistUrl}
                      </a>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCopyPlaylist}
                        title="Copy playlist URL"
                        className="h-9 w-9 rounded-lg border-2 border-[#E6DFC8] text-[#5C4033] hover:bg-white shrink-0"
                      >
                        {playlistCopied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
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
                  className="w-full h-10 rounded-xl border-2 border-[#E6DFC8] text-[#5C4033] font-black uppercase text-[10px] tracking-wide hover:bg-[#F7F4EA]"
                >
                  {isSyncing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Music className="w-3.5 h-3.5 mr-2" />}
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
                className="bg-slate-100 w-full h-10 rounded-xl border-2 border-[#E6DFC8] text-[#5C4033] font-black uppercase text-[10px] tracking-wide hover:bg-[#F7F4EA]"
              >
                <Printer className="w-3.5 h-3.5 mr-2" />
                Print Picture Sheet
              </Button>
            </div>
          )}
          {isPicture && (() => {
            const firstQ = questions.find((q) => q.question_text);
            return firstQ ? (
              <div className="px-5 py-2.5 bg-[#5C4033]/5 border-b border-[#E6DFC8]">
                <p className="pl-3 text-sm font-black text-[#5C4033]">
                  Question: <span className="font-bold text-[#1F1F1A]">{firstQ.question_text}</span>
                </p>
              </div>
            ) : null;
          })()}
          <div className="bg-amber-50 p-3 space-y-3">
            {count === 0 ? (
              <div className="py-8 text-center">
                <BookOpen className="w-6 h-6 text-[#5F624F] opacity-20 mx-auto mb-2" />
                <p className="text-xs font-black text-[#5F624F] opacity-40 uppercase tracking-wide">
                  No questions yet
                </p>
              </div>
            ) : (
              questions.map((q, idx) => {
                const isEditing = editingId === q.id;
                return (
                  <div key={q.id} className={cn(
                    "bg-white border-2 rounded-2xl p-4 shadow-sm relative overflow-hidden transition-all",
                    isEditing ? "border-[#5C4033] ring-4 ring-[#5C4033]/5" : "border-[#E6DFC8]"
                  )}>
                    {isEditing ? (
                      <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-black uppercase text-[#5F624F] tracking-wide ml-1">Question No.</label>
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
                            className="w-16 text-xs font-black text-[#5C4033] px-3 py-2 bg-white border border-[#E6DFC8] focus:border-[#5C4033] rounded-lg outline-none h-10 text-center tabular-nums"
                          />
                        </div>
                        {isPicture && q.image_url && (
                          <div className="space-y-1.5">
                            <label className="text-xs font-black uppercase text-[#5F624F] tracking-wide ml-1">Image</label>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={newImagePreview ?? q.image_url}
                              alt={q.answer_text}
                              className="w-full h-40 object-cover rounded-xl"
                            />
                            <label className="flex items-center justify-center gap-2 w-full h-9 rounded-xl border-2 border-dashed border-[#E6DFC8] text-xs font-black uppercase tracking-wide text-[#5F624F] hover:border-[#5C4033] hover:text-[#5C4033] cursor-pointer transition-all">
                              <Upload className="w-3.5 h-3.5" />
                              {newImageFile ? newImageFile.name : 'Replace image'}
                              <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                            </label>
                          </div>
                        )}
                        {!isPicture && !hideQuestionText && (
                          <div className="space-y-1.5">
                            <label className="text-xs font-black uppercase text-[#5F624F] tracking-wide ml-1">Question</label>
                            <textarea
                              title="Edit question"
                              value={editForm.question}
                              onChange={(e) => setEditForm({ ...editForm, question: e.target.value })}
                              className="w-full text-xs leading-relaxed min-h-30 p-3 bg-[#F7F4EA]/30 border-2 border-[#E6DFC8] focus:border-[#5C4033] rounded-xl outline-none resize-none"
                            />
                          </div>
                        )}
                        <div className="space-y-1.5">
                          <label className="text-xs font-black uppercase text-[#5F624F] tracking-wide ml-1">Answer</label>
                          <input
                            title="Edit answer"
                            value={editForm.answer}
                            onChange={(e) => setEditForm({ ...editForm, answer: e.target.value })}
                            className="w-full text-xs font-black text-[#5C4033] bg-[#5C4033]/10 border-2 border-[#5C4033]/15 focus:border-[#5C4033] rounded-xl outline-none h-11 px-3"
                          />
                        </div>
                        <div className="flex gap-2 pt-1">
                          <Button
                            onClick={() => saveEdit(q.id)}
                            disabled={isPending}
                            className="flex-1 bg-[#1B4332] hover:bg-[#1B4332]/85 text-white font-black uppercase text-xs tracking-wide h-10 rounded-xl"
                          >
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-3.5 h-3.5 mr-2" /> Save</>}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={cancelEditing}
                            disabled={isPending}
                            className="px-4 bg-red-500 border-2 border-[#E6DFC8] text-white font-bold uppercase text-xs h-10 rounded-xl"
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2 -mt-1">
                          <span className="text-sm font-black text-[#5C4033] shrink-0">Question {q.question_no ?? idx + 1}:</span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Question actions"
                                aria-label="Question actions"
                                className="h-7 w-7 -mr-1 rounded-xl text-[#5F624F] hover:bg-[#5C4033]/5 hover:text-[#5C4033] shrink-0"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-36">
                              <DropdownMenuItem onClick={() => startEditing(q)}>
                                <Edit2 className="w-4 h-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                disabled={isPending}
                                onClick={() => deleteQuestion(q.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="space-y-3">
                          {isHigherOrLower && q.hint_year ? (
                            <div className="space-y-2">
                              <p className="text-sm text-[#1F1F1A] leading-snug">
                                <span className="font-bold italic">{q.answer_text_ext ?? q.answer_text}</span> higher or lower than <span className="font-bold text-orange-600">{q.hint_year}</span>?
                              </p>
                              <div className="flex items-center justify-center gap-2 bg-[#7A1F1F] text-white px-3 py-2 rounded-xl w-full shadow-sm">
                                <Target className="w-3 h-3 text-white/50 shrink-0" />
                                <span className="text-xs font-black tracking-tight text-center">
                                  {(q.release_year ?? 0) > q.hint_year ? 'Higher' : 'Lower'}
                                </span>
                                <span className="text-xs font-black text-white/50 tabular-nums shrink-0">{q.release_year}</span>
                              </div>
                            </div>
                          ) : (
                            <>
                              {q.image_url ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={q.image_url}
                                  alt={q.answer_text}
                                  className="w-full h-40 object-cover rounded-xl"
                                />
                              ) : (
                                (!includeSpotify || !q.spotify_track_id) && (
                                  <p className="text-sm font-bold text-[#1F1F1A] leading-snug">
                                    {q.question_text}
                                  </p>
                                )
                              )}
                              {hideQuestionText && q.spotify_track_id && (
                                <SpotifyPlayer trackId={q.spotify_track_id} title={q.answer_text} compact />
                              )}
                              <div className="flex items-center justify-center gap-2 bg-[#1B4332] text-white px-3 py-2 rounded-xl w-full sm:w-fit sm:min-w-50 shadow-sm">
                                <Target className="w-3 h-3 text-white/50 shrink-0" />
                                <span className="text-xs font-black tracking-tight text-center">{q.answer_text}</span>
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

          {/* Generate button — hidden for events whose date has passed */}
          {!isPastEvent && (
            <div className="px-5 py-3.5 border-t border-[#E6DFC8] bg-[#F7F4EA]/50">
              <Link
                href={`/event-setups/quiz-generator?event_id=${eventId}&category=${encodeURIComponent(category_name)}`}
                className={cn(
                  "flex items-center justify-center gap-2 w-full h-10 rounded-xl font-black text-[11px] uppercase tracking-wide transition-all",
                  isComplete
                    ? "bg-white border border-[#E6DFC8] text-[#5F624F] hover:bg-[#F7F4EA]"
                    : "bg-[#9A3412] text-white hover:bg-[#9A3412]/50 shadow-sm"
                )}
              >
                <Sparkles className="w-3.5 h-3.5" />
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
