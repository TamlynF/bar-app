import React from 'react'
import { getFullQuestionHistoryAction } from '../actions'
import { 
  History, 
  MessageSquareQuote, 
  CheckCircle2, 
  Calendar,
  ArrowLeft,
  Filter
} from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'

export const dynamic = 'force-dynamic'

export default async function QuizArchivePage() {
  const history = await getFullQuestionHistoryAction()

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

        <div className="flex items-center gap-2 bg-white border border-[#E6DFC8] px-4 py-2 rounded-2xl shadow-sm">
           <Filter className="w-3.5 h-3.5 text-[#5F624F] opacity-40" />
           <span className="text-[10px] font-black uppercase tracking-widest text-[#1F1F1A]">{history.length} Questions Logged</span>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="py-32 text-center border-4 border-dashed border-[#E6DFC8] rounded-[3.5rem] bg-white/40 flex flex-col items-center">
          <MessageSquareQuote className="w-16 h-16 text-[#E6DFC8] mb-6" />
          <h2 className="font-black text-xl text-[#1F1F1A] uppercase tracking-tight">The Archive is Empty</h2>
          <p className="text-xs text-[#5F624F] mt-3 uppercase tracking-[0.15em] opacity-60 max-w-xs leading-relaxed font-bold">
            Approve some AI-generated questions to build your bar&apos;s permanent trivia library.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {history.map((record) => (
            <div 
              key={record.id}
              className="bg-white border border-[#E6DFC8] rounded-[2.25rem] overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col"
            >
              <div className="px-6 py-4 bg-[#F7F4EA]/30 border-b border-[#E6DFC8] flex items-center justify-between">
                <div className="px-2.5 py-0.5 rounded-lg bg-white border border-[#E6DFC8] text-[8px] font-black uppercase tracking-wider text-[#5F624F]">
                  {record.category}
                </div>
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-[#5F624F] opacity-60 uppercase tracking-tight">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(record.asked_on), "do MMM yyyy")}
                </div>
              </div>

              <div className="p-8 flex-grow space-y-6">
                <div className="flex gap-4">
                  <MessageSquareQuote className="w-5 h-5 text-[#26300D] shrink-0 opacity-10" />
                  <p className="text-lg font-black text-[#1F1F1A] leading-tight">
                    {record.question_text}
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-[#26300D]/5 border-2 border-dashed border-[#26300D]/10">
                  <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] mb-2 text-[#26300D]/40">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Archive Answer
                  </div>
                  <p className="text-base font-black text-[#26300D] tracking-tight">
                    {record.answer_text}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}