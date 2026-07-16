import React from 'react'
// Using absolute aliases to ensure the build environment correctly locates the modules
import { getFullQuestionHistoryAction, getQuizEventsAction } from '@/app/(private)/event-setups/quiz-generator/actions'
import {
  LayoutGrid,
  BookOpen,
  ChevronDown,
  MessageSquareQuote,
  Target
} from 'lucide-react'
import QuizHistoryFilter from '@/app/(private)/event-setups/quiz-history/_components/quiz-history-filter'
import { cn } from '@/lib/utils'

export type PastQuestionRecord = {
  id: string;
  question_text: string;
  answer_text: string;
  category: string;
  asked_on: string;
  image_url?: string | null;
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
  { bg: "bg-blue-50", border: "border-blue-200", iconBg: "bg-blue-600", text: "text-blue-900" },
  { bg: "bg-amber-50/50", border: "border-amber-200", iconBg: "bg-amber-600", text: "text-amber-900" },
  { bg: "bg-green-50/50", border: "border-green-200", iconBg: "bg-green-600", text: "text-green-700" },
  { bg: "bg-orange-50/50", border: "border-orange-200", iconBg: "bg-orange-600", text: "text-orange-900" },
  { bg: "bg-red-50/50", border: "border-red-200", iconBg: "bg-red-600", text: "text-red-900" },
  { bg: "bg-purple-50", border: "border-purple-200", iconBg: "bg-purple-600", text: "text-purple-900" },
  { bg: "bg-[#F7F4EA]", border: "border-[#E6DFC8]", iconBg: "bg-[#5F624F]", text: "text-[#1F1F1A]" },
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
    <div className="mx-auto max-w-6xl animate-in space-y-8 px-4 pt-4 pb-32 text-left duration-700 fade-in sm:px-6 sm:pt-0">
      {/* Filter Toolbar */}
      <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
        <QuizHistoryFilter
          quizEvents={quizEvents as QuizEventSummary[]}
          currentFilter={eventFilter}
        />
      </div>

      {(!history || history.length === 0) ? (
        <div className="flex flex-col items-center rounded-[3.5rem] border-4 border-dashed border-[#E6DFC8] bg-white/40 py-32 text-center">
          <BookOpen className="mb-6 h-16 w-16 text-[#E6DFC8]" />
          <h2 className="font-black text-xl tracking-tight text-[#1F1F1A] uppercase">Archive Is Empty</h2>
          <p className="mt-3 max-w-xs text-xs leading-relaxed font-bold tracking-wide text-[#5F624F] uppercase opacity-60">
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
                  "group overflow-hidden rounded-4xl border shadow-sm transition-all duration-300",
                  theme.bg,                  
                  theme.border
                )}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between p-5 transition-all outline-none select-none hover:brightness-95">
                <div className="flex items-center gap-4">
                    <div className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-xl shadow-sm transition-transform group-open:rotate-90",
                      theme.iconBg
                    )}>
                      <LayoutGrid className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className={cn("text-base font-bold tracking-tight uppercase", theme.text)}>{category}</h3>
                      <p className="text-[10px] font-bold tracking-wide text-[#5F624F] uppercase opacity-60">{questions.length} Items Logged</p>
                    </div>
                  </div>
                  <div className="h-5 w-5 text-[#5F624F] opacity-40 transition-transform group-open:rotate-180">
                    <ChevronDown className="h-5 w-5" />
                  </div>
                </summary>

                <div className="border-t border-white/40 p-3 sm:p-6">
                  <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
                    {questions.map((record) => (
                      <div
                        key={record.id}
                        className="flex flex-col overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm"
                      >
                        <div className="flex flex-1 flex-col space-y-5 p-5">
                          {/* Question Section */}
                          {record.image_url ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={record.image_url} alt={record.answer_text} className="h-44 w-full rounded-xl object-cover" />
                          ) : record.question_text ? (
                            <div className="flex items-start gap-3">
                              <div className="mt-1 rounded-lg bg-[#F7F4EA] p-1">
                                <MessageSquareQuote className="h-4 w-4 text-[#5C4033] opacity-40" />
                              </div>
                              <p className="text-sm leading-snug font-bold tracking-tight text-[#1F1F1A]">
                                {record.question_text}
                              </p>
                            </div>
                          ) : null}

                          {/* Unified Answer Box: Dark/Gold High Contrast */}
                          <div className="group/answer relative mt-auto overflow-hidden rounded-xl bg-[#5C4033] p-4 text-center shadow-inner">
                            <div className="pointer-events-none absolute top-0 left-0 h-full w-full bg-[#5C4033]/5" />
                            <div className="mb-1.5 flex items-center justify-center gap-1.5 opacity-60">
                                <Target className="h-3 w-3 text-white" />
                                <span className="font-black text-[9px] tracking-[0.2em] text-white uppercase">Correct Answer</span>
                            </div>
                            <p className="font-black text-[15px] leading-tight tracking-tight text-white">
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