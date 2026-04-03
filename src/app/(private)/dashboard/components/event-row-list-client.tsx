"use client";

import React, { useState } from "react";
import Link from "next/link";
import { format, isToday, parseISO } from "date-fns";
import { CalendarDays, ChevronRight, Clock, User, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export type EventTypeRow = { type: string; sub_type: string } | null;

export type ListItem = {
    key: string;
    date: string;
    title: string;
    startTime: string | null;
    endTime: string | null;
    eventType: EventTypeRow;
    hostName: string | null;
    guests: number;
    href: string;
};

export function EventRowListClient({ items }: { items: ListItem[] }) {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    if (items.length === 0) return null;

    return (
        <div className="bg-white border border-[#E6DFC8] rounded-2xl overflow-hidden shadow-sm">
            {items.map((item) => {
                const isExpanded = expandedId === item.key;
                const parsed = parseISO(item.date);
                const today = isToday(parsed);
                const startEndTime = item.startTime
                    ? item.startTime.substring(0, 5) + (item.endTime ? ` - ${item.endTime.substring(0, 5)}` : "--:--")
                    : "--:--" + (item.endTime ? ` - ${item.endTime.substring(0, 5)}` : "--:--");

                return (
                    <div key={item.key} className="border-b border-[#E6DFC8] last:border-0 bg-white transition-colors">
                        <button
                            type="button"
                            title="Event"
                            onClick={() => setExpandedId(isExpanded ? null : item.key)}
                            className="w-full flex items-center gap-4 px-5 py-4 hover:bg-[#F7F4EA]/60 transition-colors text-left focus:outline-none"
                        >
                            {/* Date pill */}
                            <div
                                className={cn(
                                    "shrink-0 w-14 text-center rounded-xl py-2",
                                    today ? "bg-[#FDCC4B]" : "bg-[#F7F4EA]"
                                )}
                            >
                                <p className={cn("text-[9px] font-black uppercase tracking-widest", today ? "text-[#26300D]" : "text-[#5F624F]")}>
                                    {format(parsed, "EEE")}
                                </p>
                                <p className={cn("text-xl font-black leading-tight", today ? "text-[#26300D]" : "text-[#1F1F1A]")}>
                                    {format(parsed, "d")}
                                </p>
                                <p className={cn("text-[9px] font-black uppercase tracking-widest", today ? "text-[#26300D]" : "text-[#5F624F]")}>
                                    {format(parsed, "MMM")}
                                </p>
                            </div>

                            {/* Event info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 min-w-0">
                                    <p className="text-sm font-black text-[#1F1F1A] truncate">{item.title}</p>
                                    {item.eventType && (
                                        <span className="shrink-0 whitespace-nowrap text-[9px] font-black uppercase tracking-widest bg-[#F7F4EA] text-[#5F624F] px-2 py-0.5 rounded-md">
                                            {item.eventType.sub_type || item.eventType.type}
                                        </span>
                                    )}
                                </div>
                                <p className="text-[11px] text-[#5F624F] font-medium mt-0.5 flex items-center gap-1.5 flex-wrap">
                                    <Clock className="w-4 h-4 opacity-50" />
                                    {startEndTime}
                                    {startEndTime && item.hostName && <span className="opacity-30">·</span>}
                                    {item.hostName &&
                                        <span>
                                            <div className="flex items-center gap-2">
                                                <User className="w-4 h-4 opacity-50" />
                                                {item.hostName}
                                            </div>
                                        </span>
                                    }
                                </p>
                            </div>

                            {/* Guests + arrow */}
                            <div className="shrink-0 flex items-center gap-3">
                                {item.guests > 0 && (
                                    <div className="text-right">
                                        <p className="text-sm font-black text-[#1F1F1A] tabular-nums">{item.guests}</p>
                                        <p className="text-[9px] font-bold text-[#5F624F] uppercase tracking-wider">guests</p>
                                    </div>
                                )}
                                <ChevronRight className={cn("w-4 h-4 text-[#5F624F]/40 shrink-0 transition-transform", isExpanded && "rotate-90")} />
                            </div>
                        </button>

                        {/* Expanded details */}
                        {isExpanded && (
                            <div className="border-t-2 border-[#E6DFC8] px-5 py-4 bg-[#F7F4EA]/30 animate-in fade-in duration-150">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

                                    <div className="space-y-2 text-xs text-[#5F624F]">
                                        <div className="flex items-center gap-2">
                                            <UserCheck className="w-4 h-4 opacity-50" />
                                            <span className="font-bold">Host:</span> {item.hostName || "Unassigned"}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4 opacity-50" />
                                            <span className="font-bold">Time:</span> {startEndTime}
                                        </div>
                                    </div>

                                    <Link
                                        href={item.href}
                                        className="flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-[#26300D] text-[#FDCC4B] text-[10px] font-black uppercase tracking-widest hover:bg-[#26300D]/90 transition-colors shrink-0"
                                    >
                                        Manage Bookings <ChevronRight className="w-3.5 h-3.5" />
                                    </Link>

                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    )
}