"use client"

import React, { useState } from "react";
import { format } from "date-fns";
import { 
  CalendarDays, 
  ChevronDown,
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

export default function BookingCalendarFilter({ selectedDate }: { selectedDate?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const dateValue = selectedDate ? new Date(selectedDate) : undefined;

  const handleSelect = (date: Date | undefined) => {
    const params = new URLSearchParams(searchParams.toString());
    if (date) {
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
    <div className="flex w-full items-center gap-2">
      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="group flex h-12 w-full items-center justify-between rounded-xl border-transparent bg-slate-50 px-4 text-slate-700 shadow-sm transition-all hover:bg-slate-100"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-white p-2 shadow-xs transition-transform group-hover:scale-110">
                <CalendarDays className="h-4 w-4 text-[#34451F]" />
              </div>
              <div className="flex flex-col text-left">
                <span className="mb-1 font-black text-[8px] leading-none tracking-widest text-slate-400 uppercase">Active Date</span>
                <span className="font-black text-sm tracking-tight text-slate-900 uppercase">
                  {dateValue ? format(dateValue, "eeee, do MMMM") : "All History"}
                </span>
              </div>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-300 transition-colors group-hover:text-slate-600" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="z-9999 w-screen max-w-80 overflow-hidden rounded-2xl p-0 shadow-2xl"
          align="start"
          sideOffset={8}
        >
          <Calendar
            mode="single"
            selected={dateValue}
            onSelect={handleSelect}
            className="isolate z-9999 bg-transparent"
            defaultMonth={dateValue || new Date()}
          />
          <div className="flex flex-col gap-1 border-t border-black/5 bg-black/5 p-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-10 w-full rounded-xl font-black text-[10px] tracking-widest text-[#34451F] uppercase hover:bg-white/50"
              onClick={clearFilter}
            >
              <RotateCcw className="mr-2 h-3.5 w-3.5" />
              Reset to All History
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}