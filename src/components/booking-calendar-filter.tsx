"use client"

import React, { useState } from "react";
import { format } from "date-fns";
import { 
  CalendarDays, 
  ChevronDown, 
  Sparkles,
  RotateCcw
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * BookingCalendarFilter
 * Updated to match the Dashboard's Popover-based date selection UI.
 */
export default function BookingCalendarFilter({ selectedDate }: { selectedDate?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const dateValue = selectedDate ? new Date(selectedDate) : undefined;

  const handleSelect = (date: Date | undefined) => {
    const params = new URLSearchParams(searchParams.toString());
    if (date) {
      // Normalize date to avoid timezone shifts
      const dateStr = date.toLocaleDateString('en-CA'); // YYYY-MM-DD
      params.set("date", dateStr);
    } else {
      params.delete("date");
    }
    router.push(`?${params.toString()}`);
    setIsCalendarOpen(false);
  };

  const clearFilter = () => {
    router.push(window.location.pathname);
    setIsCalendarOpen(false);
  };

  return (
    <div className="flex items-center gap-2 w-full">
      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="h-12 w-full px-4 rounded-xl bg-slate-50 border-transparent text-slate-700 hover:bg-slate-100 transition-all shadow-sm flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-xs group-hover:scale-110 transition-transform">
                <CalendarDays className="w-4 h-4 text-[#26300D]" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Active Date</span>
                <span className="text-sm font-black text-slate-900 uppercase tracking-tight">
                  {dateValue ? format(dateValue, "eeee, do MMMM") : "All History"}
                </span>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition-colors" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-screen max-w-[320px] shadow-2xl rounded-2xl overflow-hidden z-9999"
          style={{ backgroundColor: "#E2EDBF" }}
          align="start"
          sideOffset={8}
        >
          <Calendar
            mode="single"
            selected={dateValue}
            onSelect={handleSelect}
            className="bg-transparent isolate z-9999"
            defaultMonth={dateValue || new Date()}
          />
          <div className="p-3 border-t border-black/5 bg-black/5 flex flex-col gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-10 text-[10px] font-black uppercase tracking-widest text-[#26300D] hover:bg-white/50 rounded-xl"
              onClick={clearFilter}
            >
              <RotateCcw className="w-3.5 h-3.5 mr-2" />
              Reset to All History
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}