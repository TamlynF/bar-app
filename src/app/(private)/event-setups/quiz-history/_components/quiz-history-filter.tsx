"use client"

import React from 'react'
import { Filter, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'
import { QuizEventSummary } from '@/app/(private)/event-setups/quiz-generator/actions'

/**
 * Client component to handle the quiz event filtering interactivity.
 * Uses standard window.location to update search parameters, avoiding 
 * resolution issues with Next.js specific navigation hooks in certain environments.
 */
export default function QuizHistoryFilter({ 
  quizEvents, 
  currentFilter 
}: { 
  quizEvents: QuizEventSummary[], 
  currentFilter: string 
}) {

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    
    // Using standard Web URL API to construct the new path
    const url = new URL(window.location.href)
    
    if (value === 'all') {
      url.searchParams.delete('event')
    } else {
      url.searchParams.set('event', value)
    }
    
    // Trigger a navigation to the updated URL
    // This will cause the Server Component (page.tsx) to re-render with new data
    window.location.href = url.pathname + url.search
  }

  return (
    <div className="flex items-center gap-2 bg-white border-2 border-[#E6DFC8] p-1 rounded-2xl shadow-sm min-w-[280px]">
      <div className="p-2 bg-[#F7F4EA] rounded-xl">
        <Filter className="w-4 h-4 text-[#26300D]" />
      </div>
      <div className="relative flex-1 group">
        <select 
          name="event"
          title="Filter by Event"
          defaultValue={currentFilter}
          className="w-full bg-transparent border-none text-[10px] font-black uppercase tracking-wide text-[#1F1F1A] h-10 px-2 appearance-none outline-none cursor-pointer"
          onChange={handleChange}
        >
          <option value="all">All Quiz Nights</option>
          {quizEvents.map(evt => (
            <option key={evt.id} value={evt.id}>
              {evt.title || 'Quiz Night'} — {format(new Date(evt.date), "dd/MM/yy")}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[#E6DFC8] pointer-events-none" />
      </div>
    </div>
  )
}