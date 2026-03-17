import React from 'react'
// Using absolute aliases to ensure the build environment correctly locates the modules
import { getFullQuestionHistoryAction, getQuizEventsAction } from '@/app/(private)/quiz-generator/actions'
import Link from 'next/link'
import { 
  History, 
  CheckCircle2, 
  ArrowLeft,
  LayoutGrid,
  BookOpen,
  ChevronDown,
  MessageSquareQuote
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
  
  // Data fetching from the server actions
  const [history, quizEvents] = await Promise.all([
    getFullQuestionHistoryAction(eventFilter),
    getQuizEventsAction()
  ]);

  // Type-safe grouping of history data
  const groupedQuestions = (history as PastQuestionRecord[] || []).reduce((acc: Record<string, PastQuestionRecord[]>, q: PastQuestionRecord) => {
    const catName = q.quiz_category_configs?.category_name || q.category || "General Knowledge";
    if (!acc[catName]) acc[catName] = [];
    acc[catName].push(q);
    return acc;
  }, {});

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-8 animate-in fade-in duration-700 pb-32 text-left">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Link 
            href="/quiz-generator"
            className="p-2 hover:bg-[#26300D]/5 rounded-full transition-colors group"
            title="Back to Generator"
          >
            <ArrowLeft className="w-6 h-6 text-[#1F1F1A] group-hover:-translate-x-1 transition-transform" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#FDCC4B] rounded-lg shadow-sm shrink-0">
              <History className="w-5 h-5 text-[#26300D]" />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight text-[#1F1F1A] leading-none">Question Archive</h1>
              <p className="text-[10px] text-[#5F624F] font-bold uppercase tracking-wider mt-1 opacity-60">Past trivia items used at the bar</p>
            </div>
          </div>
        </div>

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

              <div className="p-2 sm:p-4 border-t border-[#E6DFC8] bg-slate-50/10">
                <div className="grid grid-cols-1 gap-3">
                  {questions.map((record) => (
                    <div 
                      key={record.id} 
                      className="bg-white border border-[#E6DFC8]/60 rounded-2xl p-4 sm:p-6 shadow-xs transition-all hover:border-[#26300D]/20 group/card"
                    >
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 sm:gap-6">
                        {/* Question Content - Takes full width on mobile */}
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-2">
                             <MessageSquareQuote className="w-4 h-4 text-[#26300D] opacity-20" />
                             <span className="text-[9px] font-black text-[#5F624F] uppercase tracking-widest opacity-60">Trivia Question</span>
                          </div>
                          <p className="text-base sm:text-lg font-black text-[#1F1F1A] leading-[1.4] tracking-tight">
                            {record.question_text}
                          </p>
                        </div>

                        {/* Answer Content - High contrast box that looks intentional even when short */}
                        <div className="w-full md:w-1/3 shrink-0">
                          <div className="bg-[#FDCC4B]/10 border-2 border-[#FDCC4B]/30 p-4 rounded-xl sm:rounded-2xl transition-all group-hover/card:bg-[#FDCC4B]/20 h-full flex flex-col justify-center">
                             <div className="flex items-center gap-2 mb-2">
                               <CheckCircle2 className="w-3.5 h-3.5 text-[#26300D] opacity-40" />
                               <span className="text-[9px] font-black text-[#26300D]/60 uppercase tracking-widest">Verified Answer</span>
                             </div>
                             <p className="text-sm sm:text-base font-black text-[#26300D] leading-tight">
                               {record.answer_text}
                             </p>
                          </div>
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