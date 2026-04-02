"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type Question = {
  id: string;
  question_text: string;
  answer_text: string;
  quiz_category_configs_id: number | null;
};

type Props = {
  eventId: number;
  category_name: string;
  question_count: number;
  questions: Question[];
};

export default function CategorySection({ eventId, category_name, question_count, questions }: Props) {
  const count = questions.length;
  const isComplete = count >= question_count;
  const hasAny = count > 0;
  const [open, setOpen] = useState(hasAny);

  return (
    <section className="bg-white border border-[#E6DFC8] rounded-2xl overflow-hidden">
      {/* Category header — tap to toggle */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-[#F7F4EA] hover:bg-[#F0EDE0] transition-colors text-left"
      >
        <p className="text-[11px] font-black uppercase tracking-widest text-[#26300D]">
          {category_name}
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
              questions.map((q, idx) => (
                <div key={q.id} className="px-5 py-4 flex items-start gap-3">
                  <span className="text-[10px] font-black text-[#26300D]/20 mt-0.5 shrink-0 tabular-nums w-5 text-right">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <p className="text-sm font-bold text-[#1F1F1A] leading-snug">
                      {q.question_text}
                    </p>
                    <p className="text-[11px] font-black text-[#5F624F] bg-[#F7F4EA] border border-[#E6DFC8] rounded-xl px-3 py-1.5 w-fit">
                      {q.answer_text}
                    </p>
                  </div>
                </div>
              ))
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
    </section>
  );
}
