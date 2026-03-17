import React from 'react'
import { getFullQuestionHistoryAction, getQuizEventsAction, PastQuestionRecord } from '../actions'
import Link from 'next/link'
import { 
  History, 
  CheckCircle2, 
  ArrowLeft,
  Filter,
  ChevronDown,
  LayoutGrid,
  BookOpen
} from 'lucide-react'
import { format } from 'date-fns'

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
  const groupedQuestions = history.reduce((acc, q) => {
    const catName = q.quiz_category_configs?.category_name || q.category || "General Knowledge";
    if (!acc[catName]) acc[catName] = [];
    acc[catName].push(q);
    return acc;
  }, {} as Record<string, PastQuestionRecord[]>);

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-8 animate-in fade-in duration-700 pb-32 text-left">
      {/* Navigation Header */}
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

        {/* Quiz Event Filter Dropdown */}
        <form className="flex items-center gap-2 bg-white border-2 border-[#E6DFC8] p-1 rounded-2xl shadow-sm min-w-[280px]">
          <div className="p-2 bg-[#F7F4EA] rounded-xl">
            <Filter className="w-4 h-4 text-[#26300D]" />
          </div>
          <div className="relative flex-1 group">
            <select 
              name="event"
              title="Filter by Event"
              defaultValue={eventFilter}
              className="w-full bg-transparent border-none text-[10px] font-black uppercase tracking-widest text-[#1F1F1A] h-10 px-2 appearance-none outline-none cursor-pointer"
              onChange={(e) => {
                const url = new URL(window.location.href);
                url.searchParams.set('event', e.target.value);
                window.location.href = url.toString();
              }}
            >
              <option value="all">All Quiz Nights</option>
              {quizEvents.map(evt => (
                <option key={evt.id} value={evt.id}>
                  {evt.title || 'Quiz Night'} — {format(new Date(evt.date), "dd/MM/yy")}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300 pointer-events-none" />
          </div>
        </form>
      </div>

      {history.length === 0 ? (
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
            <details key={category} className="group border border-[#E6DFC8] rounded-[2rem] bg-white overflow-hidden shadow-sm" open>
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
                <ChevronDown className="w-5 h-5 text-[#E6DFC8] group-open:rotate-180 transition-transform" />
              </summary>

              <div className="p-1 border-t border-[#E6DFC8]">
                <table className="w-full border-collapse">
                  <thead className="bg-[#F7F4EA]/30 text-left border-b border-[#E6DFC8]">
                    <tr>
                      <th className="px-6 py-3 text-[9px] font-black uppercase tracking-widest text-[#5F624F]">Question Text</th>
                      <th className="px-6 py-3 text-[9px] font-black uppercase tracking-widest text-[#5F624F]">Verified Answer</th>
                      <th className="px-6 py-3 text-[9px] font-black uppercase tracking-widest text-[#5F624F] text-right">Asked</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6DFC8]/50">
                    {questions.map((record) => (
                      <tr key={record.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-5">
                          <p className="text-sm font-black text-[#1F1F1A] leading-relaxed max-w-lg">
                            {record.question_text}
                          </p>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2 text-sm font-bold text-[#26300D]">
                            <CheckCircle2 className="w-3.5 h-3.5 opacity-30" />
                            {record.answer_text}
                          </div>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <span className="text-[10px] font-black text-[#5F624F] opacity-40 whitespace-nowrap">
                            {format(new Date(record.asked_on), "dd MMM")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  )
}