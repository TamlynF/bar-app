"use client"

import React from 'react'
import { Filter, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'
import { QuizEventSummary } from '@/app/(private)/event-setups/quiz-generator/actions'

export default function QuizHistoryFilter({ 
  quizEvents, 
  currentFilter 
}: { 
  quizEvents: QuizEventSummary[], 
  currentFilter: string 
}) {

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    
    const url = new URL(window.location.href)
    
    if (value === 'all') {
      url.searchParams.delete('event')
    } else {
      url.searchParams.set('event', value)
    }
    
    window.location.href = url.pathname + url.search
  }

  return (
    <div className="flex min-w-70 items-center gap-2 rounded-2xl border-2 border-[#E6DFC8] bg-white p-1 shadow-sm">
      <div className="rounded-xl bg-[#F7F4EA] p-2">
        <Filter className="h-4 w-4 text-[#5C4033]" />
      </div>
      <div className="group relative flex-1">
        <select 
          name="event"
          title="Filter by Event"
          defaultValue={currentFilter}
          className="h-10 w-full cursor-pointer appearance-none border-none bg-transparent px-2 font-black text-[10px] tracking-wide text-[#1F1F1A] uppercase outline-none"
          onChange={handleChange}
        >
          <option value="all">All Quiz Nights</option>
          {quizEvents.map(evt => (
            <option key={evt.id} value={evt.id}>
              {evt.title || 'Quiz Night'} — {format(new Date(evt.date), "dd/MM/yy")}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-[#E6DFC8]" />
      </div>
    </div>
  )
}