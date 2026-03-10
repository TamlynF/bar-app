"use client"

import React from "react";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * QuizCalendarFilter (Client Component)
 * Handles the interactive date selection and URL updates.
 */
export default function BookingCalendarFilter({ selectedDate }: { selectedDate?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSelect = (date: Date | undefined) => {
    const params = new URLSearchParams(searchParams.toString());
    if (date) {
      params.set("date", date.toISOString().split("T")[0]);
    } else {
      params.delete("date");
    }
    router.push(`?${params.toString()}`);
  };

  const clearFilter = () => {
    router.push(window.location.pathname);
  };

  return (
    <div className="bg-white border border-[#E6DFC8] rounded-3xl p-6 shadow-sm sticky top-24">
      <div className="flex items-center gap-2 mb-4 px-2">
        <CalendarIcon className="w-4 h-4 text-[#26300D]" />
        <span className="font-black text-[10px] uppercase tracking-widest text-[#1F1F1A]">Filter by Date</span>
      </div>
      
      <Calendar
        mode="single"
        selected={selectedDate ? new Date(selectedDate) : undefined}
        onSelect={handleSelect}
        className="rounded-2xl border-none p-0 mx-auto"
      />
      
      <div className="mt-6 pt-6 border-t border-[#E6DFC8] space-y-3">
        <Link 
          href="/quiz-generator"
          className="flex items-center justify-center gap-2 w-full py-3 bg-[#26300D] text-[#FDCC4B] rounded-2xl font-black text-[11px] uppercase tracking-widest hover:scale-[1.02] transition-transform active:scale-95"
        >
          AI Generator
        </Link>
        
        {selectedDate && (
          <Button 
            variant="ghost"
            className="w-full text-[10px] font-black uppercase tracking-widest text-[#5F624F] hover:bg-red-50 hover:text-red-600"
            onClick={clearFilter}
          >
            Clear Date Filter
          </Button>
        )}
      </div>
    </div>
  );
}