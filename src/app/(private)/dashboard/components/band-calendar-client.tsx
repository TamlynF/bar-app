"use client"

import React, { useState } from "react"
import { Calendar } from "@/components/ui/calendar"

interface BandCalendarClientProps {
  confirmedDateStrings: string[]
  pendingDateStrings: string[]
  popularDateString: string | null
}

export function BandCalendarClient({
  confirmedDateStrings,
  pendingDateStrings,
  popularDateString,
}: BandCalendarClientProps) {
  const [month, setMonth] = useState(new Date())

  const confirmedDates = confirmedDateStrings.map((s) => new Date(s))
  const pendingDates = pendingDateStrings.map((s) => new Date(s))
  const popularDates = popularDateString ? [new Date(popularDateString)] : []

  return (
    <div className="space-y-3">
      <Calendar
        month={month}
        onMonthChange={setMonth}
        modifiers={{
          confirmed: confirmedDates,
          pending: pendingDates,
          ...(popularDates.length > 0 ? { popular: popularDates } : {}),
        }}
        modifiersClassNames={{
          confirmed: "!bg-[#5C4033] !text-white !rounded-md",
          pending: "!bg-[#C8956D]/60 !text-[#5C4033] !rounded-md !font-bold",
          popular: "!ring-2 !ring-[#C8956D] !ring-offset-1 !rounded-md",
        }}
        className="w-full"
      />

      <div className="flex flex-wrap items-center gap-4 border-t border-[#E6DFC8] pt-2">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm bg-[#5C4033]" />
          <span className="text-[10px] font-bold tracking-wide text-[#5F624F] uppercase">Confirmed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm border border-[#C8956D] bg-[#C8956D]/60" />
          <span className="text-[10px] font-bold tracking-wide text-[#5F624F] uppercase">Requested</span>
        </div>
        {popularDates.length > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm ring-2 ring-[#C8956D] ring-offset-1" />
            <span className="text-[10px] font-bold tracking-wide text-[#5F624F] uppercase">Most popular</span>
          </div>
        )}
      </div>
    </div>
  )
}
