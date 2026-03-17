import React from 'react'
// Using absolute aliases to ensure the build environment correctly locates the modules
import { getFullQuestionHistoryAction, getQuizEventsAction } from '@/app/(private)/quiz-generator/actions'
import Link from 'next/link'
import {
  LayoutGrid,
  BookOpen,
  ChevronDown,
  MessageSquareQuote,
  Check
} from 'lucide-react'
import QuizHistoryFilter from '@/app/(private)/quiz-generator/history/_components/quiz-history-filter'

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

  // Group questions by category name for the expandable sections
  const groupedQuestions = (history as PastQuestionRecord[] || []).reduce((acc: Record<string, PastQuestionRecord[]>, q: PastQuestionRecord) => {
    const catName = q.quiz_category_configs?.category_name || q.category || "General Knowledge";
    if (!acc[catName]) acc[catName] = [];
    acc[catName].push(q);
    return acc;
  }, {});

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-8 animate-in fade-in duration-700 pb-32 text-left">
      {/* Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        {/* Filter Toolbar */}
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
          {Object.entries(groupedQuestions).map(([category, questions]) => (
            /* ALL groupings are collapsed by default (no 'open' attribute) */
            <details key={category} className="group border border-[#E6DFC8] rounded-[2rem] bg-white overflow-hidden shadow-sm">
              <summary className="flex items-center justify-between p-5 cursor-pointer list-none select-none outline-none hover:bg-[#F7F4EA]/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#26300D] flex items-center justify-center group-open:rotate-90 transition-transform">
                    <LayoutGrid className="w-5 h-5 text-[#FDCC4B]" />
                  </div>
                  <div>
                    <h3 className="text-base font-black uppercase tracking-tight text-[#1F1F1A]">{category}</h3>
                    <p className="text-[10px] text-[#5F624F] font-bold opacity-60 uppercase tracking-widest">{questions.length} Items Logged</p>
                  </div>
                </div>
                <div className="w-5 h-5 text-[#E6DFC8] group-open:rotate-180 transition-transform">
                    <ChevronDown className="w-5 h-5" />
                </div>
              </summary>

              <div className="p-3 sm:p-5 border-t border-[#E6DFC8] bg-slate-50/10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {questions.map((record) => (
                    <div 
                      key={record.id} 
                      className="group relative flex flex-col bg-white border-2 border-[#26300D]/10 rounded-2xl shadow-xs transition-all hover:border-[#26300D]/20 overflow-hidden"
                    >
                      <div className="px-5 py-4 space-y-4 relative">
                        {/* Floating Indicator - Top Right UI matching the generator's selected state */}
                        <div className="absolute top-4 right-4 w-5 h-5 rounded-full flex items-center justify-center border-2 bg-[#26300D] border-[#26300D] text-[#FDCC4B] shadow-sm z-10">
                          <Check className="w-3 h-3 stroke-[4]" />
                        </div>

                        {/* Question Content - Added pr-10 to prevent overlap with floating indicator */}
                        <div className="flex items-start gap-2.5 pr-10">
                           <MessageSquareQuote className="w-4 h-4 text-[#26300D] shrink-0 opacity-10 mt-0.5" />
                           <p className="text-[13px] font-black text-[#1F1F1A] leading-snug tracking-tight">
                             {record.question_text}
                           </p>
                        </div>
                        
                        {/* Answer Content - Center aligned, brand background, no "Answer" text */}
                        <div className="p-2.5 rounded-xl border border-[#FDCC4B]/40 bg-[#FDCC4B]/10 text-center transition-all duration-500">
                          <p className="text-[12px] font-black text-[#26300D] leading-tight">
                            {record.answer_text}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  )
}