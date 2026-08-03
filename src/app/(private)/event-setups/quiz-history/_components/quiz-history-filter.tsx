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
    <div className="flex h-12 min-w-0 items-center gap-2 rounded-2xl border border-admin-line bg-admin-card px-2 sm:w-72 sm:shrink-0">
      <Filter className="h-4 w-4 shrink-0 text-admin-muted" />
      <div className="relative min-w-0 flex-1">
        <select
          name="event"
          title="Filter by quiz night"
          aria-label="Filter by quiz night"
          defaultValue={currentFilter}
          className="h-11 w-full cursor-pointer appearance-none truncate border-none bg-transparent pr-7 text-base text-admin-ink outline-none sm:text-sm"
          onChange={handleChange}
        >
          <option value="all">All quiz nights</option>
          {quizEvents.map(evt => (
            <option key={evt.id} value={evt.id}>
              {evt.title || 'Quiz Night'} - {format(new Date(`${evt.date}T00:00:00`), "dd/MM/yy")}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-1 h-4 w-4 -translate-y-1/2 text-admin-muted" />
      </div>
    </div>
  )
}
