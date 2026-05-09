"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { BookOpen, ChevronDown, Sparkles, Edit2, Trash2, Save, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SpotifyPlayer } from "@/components/spotify-player";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import {
  updatePastQuestionAction,
  deletePastQuestionAction,
} from "@/app/(private)/event-setups/quiz-generator/actions";

type Question = {
  id: string;
  question_text: string;
  answer_text: string;
  quiz_category_configs_id: number | null;
  spotify_track_id?: string | null;
  hint_year?: number | null;
  release_year?: number | null;
};

type Props = {
  eventId: number;
  category_name: string;
  question_count: number;
  questions: Question[];
  orderNo?: number;
  includeSpotify?: boolean;
  autoOpen?: boolean;
};

export default function CategorySection({ eventId, category_name, question_count, questions: initialQuestions, orderNo, includeSpotify, autoOpen }: Props) {
  const { confirm, ConfirmDialogUI } = useConfirm();
  const [questions, setQuestions] = useState(initialQuestions);
  const isHigherOrLower = includeSpotify && category_name.toLowerCase().includes('higher');
  const count = questions.length;
  const isComplete = count >= question_count;
  const hasAny = count > 0;
  const [open, setOpen] = useState(!!autoOpen);
  const sectionRef = useRef<HTMLElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (autoOpen && sectionRef.current) {
      setTimeout(() => {
        sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, [autoOpen]);
  const [editForm, setEditForm] = useState({ question: "", answer: "" });
  const [isPending, setIsPending] = useState(false);

  const startEditing = (q: Question) => {
    setEditingId(q.id);
    setEditForm({ question: q.question_text, answer: q.answer_text });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({ question: "", answer: "" });
  };

  const saveEdit = async (id: string) => {
    if (!editForm.question || !editForm.answer) {
      toast.error("Fields cannot be empty");
      return;
    }
    setIsPending(true);
    try {
      await updatePastQuestionAction(id, editForm.question, editForm.answer);
      setQuestions((prev) =>
        prev.map((q) => (q.id === id ? { ...q, question_text: editForm.question, answer_text: editForm.answer } : q))
      );
      toast.success("Question updated");
      setEditingId(null);
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
    } catch {
      toast.error("Delete failed");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <section ref={sectionRef} className="bg-white border border-[#E6DFC8] rounded-2xl overflow-hidden">
      {/* Category header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-[#F7F4EA] hover:bg-[#F0EDE0] transition-colors text-left"
      >
        <p className="text-[11px] font-black uppercase tracking-widest text-[#26300D]">
          {orderNo != null ? `${orderNo}. ` : ''}{category_name}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={cn(
              "text-[10px] font-black tabular-nums px-2.5 py-1 rounded-lg border",
              isComplete
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
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
          <div className="divide-y divide-[#E6DFC8]">
            {count === 0 ? (
              <div className="px-5 py-8 text-center">
                <BookOpen className="w-6 h-6 text-[#5F624F] opacity-20 mx-auto mb-2" />
                <p className="text-xs font-black text-[#5F624F] opacity-40 uppercase tracking-widest">
                  No questions yet
                </p>
              </div>
            ) : (
              questions.map((q, idx) => {
                const isEditing = editingId === q.id;
                return (
                  <div key={q.id} className={cn(
                    "px-3 py-3 transition-all",
                    isEditing && "bg-[#F7F4EA]/50"
                  )}>
                    {isEditing ? (
                      <div className="space-y-2.5 animate-in fade-in duration-200">
                        <div className="space-y-1">
                          <label className="text-[8px] font-black uppercase text-[#5F624F] tracking-widest">Question</label>
                          <textarea
                            title="Edit question"
                            value={editForm.question}
                            onChange={(e) => setEditForm({ ...editForm, question: e.target.value })}
                            className="w-full text-[13px] font-semibold min-h-[60px] p-2.5 bg-white border border-[#E6DFC8] focus:border-[#26300D] rounded-lg outline-none resize-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-black uppercase text-[#5F624F] tracking-widest">Answer</label>
                          <input
                            title="Edit answer"
                            value={editForm.answer}
                            onChange={(e) => setEditForm({ ...editForm, answer: e.target.value })}
                            className="w-full text-[13px] font-black text-[#26300D] p-2.5 bg-white border border-[#E6DFC8] focus:border-[#26300D] rounded-lg outline-none h-10"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => saveEdit(q.id)}
                            disabled={isPending}
                            className="flex-1 bg-[#26300D] text-white font-black uppercase text-[10px] tracking-widest h-9 rounded-xl"
                          >
                            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Save className="w-3.5 h-3.5 mr-1.5" /> Save</>}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={cancelEditing}
                            disabled={isPending}
                            className="px-3 border border-[#E6DFC8] text-[#5F624F] font-bold uppercase text-[10px] h-9 rounded-xl"
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <span className="text-[10px] font-black text-[#26300D]/20 mt-0.5 shrink-0 tabular-nums w-5 text-right">
                            Q{idx + 1}
                          </span>
                          <div className="flex-1 min-w-0 space-y-1.5">
                            {isHigherOrLower && q.hint_year ? (
                              <>
                                <p className="text-[10px] font-black text-amber-700 leading-tight">
                                  Higher or Lower than {q.hint_year}?
                                </p>
                                <p className="text-[11px] font-black text-[#5F624F] bg-[#F7F4EA] border border-[#E6DFC8] rounded-xl px-3 py-1.5 w-fit">
                                  {q.release_year}
                                </p>
                              </>
                            ) : (
                              <>
                                {(!includeSpotify || !q.spotify_track_id) && (
                                  <p className="text-sm font-bold text-[#1F1F1A] leading-snug">
                                    {q.question_text}
                                  </p>
                                )}
                                <p className="text-[11px] font-black text-[#5F624F] bg-[#F7F4EA] border border-[#E6DFC8] rounded-xl px-3 py-1.5 w-fit">
                                  {q.answer_text}
                                </p>
                              </>
                            )}
                          </div>
                          <div className="flex flex-col gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => startEditing(q)}
                              className="h-7 w-7 rounded-lg text-orange-500 hover:bg-orange-50 hover:text-orange-600"
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteQuestion(q.id)}
                              disabled={isPending}
                              className="h-7 w-7 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        {includeSpotify && q.spotify_track_id && (
                          <div className="ml-8">
                            <SpotifyPlayer trackId={q.spotify_track_id} title={q.answer_text} compact />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Generate button */}
          <div className="px-5 py-3.5 border-t border-[#E6DFC8] bg-[#F7F4EA]/50">
            <Link
              href={`/event-setups/quiz-generator?event_id=${eventId}&category=${encodeURIComponent(category_name)}`}
              className={cn(
                "flex items-center justify-center gap-2 w-full h-10 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all",
                isComplete
                  ? "bg-white border border-[#E6DFC8] text-[#5F624F] hover:bg-[#F7F4EA]"
                  : "bg-[#26300D] text-[#FDCC4B] hover:bg-[#26300D]/90 shadow-sm"
              )}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isComplete ? "Generate Extra" : "Generate Questions"}
            </Link>
          </div>
        </>
      )}
      {ConfirmDialogUI}
    </section>
  );
}
