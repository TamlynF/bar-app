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
          confirmed: "!bg-[#26300D] !text-white !rounded-md",
          pending: "!bg-[#FDCC4B]/60 !text-[#26300D] !rounded-md !font-bold",
          popular: "!ring-2 !ring-[#FDCC4B] !ring-offset-1 !rounded-md",
        }}
        className="w-full"
      />

      <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-[#E6DFC8]">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-[#26300D]" />
          <span className="text-[10px] font-bold uppercase tracking-wide text-[#5F624F]">Confirmed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-[#FDCC4B]/60 border border-[#FDCC4B]" />
          <span className="text-[10px] font-bold uppercase tracking-wide text-[#5F624F]">Requested</span>
        </div>
        {popularDates.length > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm ring-2 ring-[#FDCC4B] ring-offset-1" />
            <span className="text-[10px] font-bold uppercase tracking-wide text-[#5F624F]">Most popular</span>
          </div>
        )}
      </div>
    </div>
  )
}
