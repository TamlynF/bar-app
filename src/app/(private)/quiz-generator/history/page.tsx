import React from 'react'
// Using absolute aliases to ensure the build environment correctly locates the modules
import { getFullQuestionHistoryAction, getQuizEventsAction } from '@/app/(private)/quiz-generator/actions'
import {
  LayoutGrid,
  BookOpen,
  ChevronDown,
  MessageSquareQuote,
  Target
} from 'lucide-react'
import QuizHistoryFilter from '@/app/(private)/quiz-generator/history/_components/quiz-history-filter'
import { cn } from '@/lib/utils'

export type PastQuestionRecord = {
  id: string;
  question_text: string;
  answer_text: string;
  category: string;
  asked_on: string;
  quiz_category_configs?: {
    category_name: string;
  } | null;
}

export type QuizEventSummary = {
  id: number;
  title: string | null;
  date: string;
}

// UI/UX Theme palette for category differentiation
const CATEGORY_THEMES = [
  { bg: "bg-blue-100/40", border: "border-blue-300/50", iconBg: "bg-blue-600", text: "text-blue-900" },
  { bg: "bg-amber-50/50", border: "border-amber-200", iconBg: "bg-amber-600", text: "text-amber-900" },
  { bg: "bg-emerald-50/50", border: "border-emerald-200", iconBg: "bg-emerald-600", text: "text-emerald-900" },
  { bg: "bg-orange-50/50", border: "border-orange-200", iconBg: "bg-orange-600", text: "text-orange-900" },
  { bg: "bg-red-50/50", border: "border-red-200", iconBg: "bg-red-600", text: "text-red-900" },
  { bg: "bg-purple-100/40", border: "border-purple-300/50", iconBg: "bg-purple-600", text: "text-purple-900" },
  { bg: "bg-slate-100/40", border: "border-slate-300/50", iconBg: "bg-slate-600", text: "text-slate-900" },
];

export const dynamic = 'force-dynamic'

export default async function QuizArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const params = await searchParams;
  const eventFilter = params.event || 'all';

  const [history, quizEvents] = await Promise.all([
    getFullQuestionHistoryAction(eventFilter),
    getQuizEventsAction()
  ]);

  const groupedQuestions = (history as PastQuestionRecord[] || []).reduce((acc: Record<string, PastQuestionRecord[]>, q: PastQuestionRecord) => {
    const catName = q.quiz_category_configs?.category_name || q.category || "General Knowledge";
    if (!acc[catName]) acc[catName] = [];
    acc[catName].push(q);
    return acc;
  }, {});

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-8 animate-in fade-in duration-700 pb-32 text-left">
      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <QuizHistoryFilter
          quizEvents={quizEvents as QuizEventSummary[]}
          currentFilter={eventFilter}
        />
      </div>

      {(!history || history.length === 0) ? (
        <div className="py-32 text-center border-4 border-dashed border-[#E6DFC8] rounded-[3.5rem] bg-white/40 flex flex-col items-center">
          <BookOpen className="w-16 h-16 text-[#E6DFC8] mb-6" />
          <h2 className="font-black text-xl text-[#1F1F1A] uppercase tracking-tight">Archive Is Empty</h2>
          <p className="text-xs text-[#5F624F] mt-3 uppercase tracking-widest opacity-60 max-w-xs font-bold leading-relaxed">
            There are no approved questions for this specific filter.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedQuestions).map(([category, questions], index) => {
            const theme = CATEGORY_THEMES[index % CATEGORY_THEMES.length];
            console.log("Rendering category:", index, " ", theme);
            return (
              <details 
                key={category} 
                className={cn(
                  "group border rounded-[2rem] overflow-hidden shadow-sm transition-all duration-300",
                  theme.bg,                  
                  theme.border
                )}
              >
                <summary className="flex items-center justify-between p-5 cursor-pointer list-none select-none outline-none hover:brightness-95 transition-all">
                <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center group-open:rotate-90 transition-transform shadow-sm",
                      theme.iconBg
                    )}>
                      <LayoutGrid className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className={cn("text-base font-black uppercase tracking-tight", theme.text)}>{category}</h3>
                      <p className="text-[10px] text-[#5F624F] font-bold opacity-60 uppercase tracking-widest">{questions.length} Items Logged</p>
                    </div>
                  </div>
                  <div className="w-5 h-5 text-[#5F624F] opacity-40 group-open:rotate-180 transition-transform">
                    <ChevronDown className="w-5 h-5" />
                  </div>
                </summary>

                <div className="p-3 sm:p-6 border-t border-white/40">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    {questions.map((record) => (
                      <div
                        key={record.id}
                        className="flex flex-col bg-white border border-black/5 rounded-2xl shadow-sm overflow-hidden"
                      >
                        <div className="p-5 flex-1 space-y-5 flex flex-col">
                          {/* Question Section */}
                          <div className="flex items-start gap-3">
                            <div className="mt-1 p-1 bg-slate-50 rounded-lg">
                                <MessageSquareQuote className="w-4 h-4 text-[#26300D] opacity-40" />
                            </div>
                            <p className="text-[14px] font-bold text-[#1F1F1A] leading-snug tracking-tight">
                              {record.question_text}
                            </p>
                          </div>

                          {/* Unified Answer Box: Dark/Gold High Contrast */}
                          <div className="mt-auto p-4 rounded-xl bg-[#26300D] text-center shadow-inner relative overflow-hidden group/answer">
                            <div className="absolute top-0 left-0 w-full h-full bg-[#FDCC4B]/5 pointer-events-none" />
                            <div className="flex items-center justify-center gap-1.5 mb-1.5 opacity-60">
                                <Target className="w-3 h-3 text-[#FDCC4B]" />
                                <span className="text-[9px] font-black text-[#FDCC4B] uppercase tracking-[0.2em]">Correct Answer</span>
                            </div>
                            <p className="text-[15px] font-black text-white leading-tight tracking-tight">
                              {record.answer_text}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  )
}