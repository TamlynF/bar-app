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
    <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 sm:p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:border-primary/30 w-full">
      <div className="flex items-center gap-2">
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm"
            >
              <CalendarDays className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              <div className="flex flex-col text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-slate-900 dark:text-white uppercase truncate max-w-[120px] sm:max-w-40">
                    {dateValue ? format(dateValue, "dd MMMM yyyy") : "All Dates"}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </div>
              </div>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="border-amber-500/20 p-0 w-auto shadow-xl rounded-xl overflow-hidden isolate z-9999"
            style={{ backgroundColor: "#c8cfb8" }}
            align="start"
          >
            <Calendar
              mode="single"
              selected={dateValue}
              onSelect={handleSelect}
              className="text-white bg-[#1a2109] isolate z-9999"
              style={{ backgroundColor: "#9aa67e" }}
              defaultMonth={dateValue || new Date()}
            />
            <div className="p-2 border-t border-white/10 bg-black/20 flex flex-col gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs font-semibold text-slate-100 hover:text-white hover:bg-white/10"
                onClick={clearFilter}
              >
                <RotateCcw className="w-3 h-3 mr-2" />
                Show All History
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {selectedDate && (
           <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearFilter}
            className="h-9 px-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500 transition-colors hidden sm:flex"
           >
             Clear
           </Button>
        )}
      </div>

      {/* Action Area - AI Generator shortcut */}
      <div className="flex items-center gap-2">
        <Link href="/quiz-generator" className="hidden sm:block">
          <Button 
            variant="outline" 
            size="sm" 
            className="h-9 rounded-lg border-[#26300D]/10 bg-[#FDCC4B]/10 text-[#26300D] font-black text-[10px] uppercase tracking-wider hover:bg-[#FDCC4B]/20"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            AI Generator
          </Button>
        </Link>
        
        {/* Compact version for mobile */}
        <Link href="/quiz-generator" className="sm:hidden">
           <Button size="icon" variant="outline" className="h-9 w-9 rounded-lg bg-[#FDCC4B] text-[#26300D] border-none shadow-sm">
             <Sparkles className="w-4 h-4" />
           </Button>
        </Link>
      </div>
    </div>
  );
}