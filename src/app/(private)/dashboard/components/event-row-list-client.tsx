"use client";

import Link from "next/link";
import { format, isToday, parseISO } from "date-fns";
import { ChevronRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { badgeClassFromColor, FALLBACK_BADGE } from "@/lib/event-type-colors";

export type EventTypeRow = { type: string; sub_type: string; badge_color?: string | null } | null;

export type ListItem = {
    key: string;
    eventId: number;
    date: string;
    title: string;
    startTime: string | null;
    endTime: string | null;
    eventType: EventTypeRow;
    hostName: string | null;
    guests: number;
    href: string;
};

function TonightBadge() {
    return (
        <span className="inline-flex shrink-0 items-center gap-1.5">
            <span className="ad-blink h-1.5 w-1.5 rounded-full bg-[#FF6B35] shadow-[0_0_8px_#FF6B35]" aria-hidden="true" />
            <span className="font-black text-[9px] tracking-[0.15em] text-[#FF6B35] uppercase">On tonight</span>
        </span>
    );
}

function badgeClass(eventType: EventTypeRow): string {
    if (!eventType) return FALLBACK_BADGE;
    return badgeClassFromColor(eventType.badge_color);
}

function badgeLabel(eventType: EventTypeRow): string {
    const raw = eventType?.sub_type || eventType?.type || "";
    return raw.charAt(0).toUpperCase() + raw.slice(1).replace(/-/g, " ");
}

export function EventRowListClient({ items }: { items: ListItem[] }) {
    if (items.length === 0) return null;

    return (
        <div className="flex flex-col overflow-hidden rounded-2xl border border-[#D8D5C8] bg-white">
            {items.map((item) => {
                const parsed = parseISO(item.date);
                const today = isToday(parsed);
                const startEndTime = item.startTime
                    ? item.startTime.substring(0, 5) + (item.endTime ? ` - ${item.endTime.substring(0, 5)}` : "")
                    : "--:--";

                return (
                    <Link
                        key={item.key}
                        href={`/event-setups/events?open=${item.eventId}`}
                        title="Open event"
                        className="group flex items-center gap-3 border-b border-[#D8D5C8] px-3 py-2.5 transition-colors last:border-0 hover:bg-amber-50"
                    >
                        <div className={cn(
                            "w-11 shrink-0 rounded-lg py-0.5 text-center sm:w-12 sm:py-1",
                            today ? "bg-[#FF6B35]" : "bg-[#F4F1E8]"
                        )}>
                            <p className={cn("text-[9px] font-bold tracking-wide uppercase", today ? "text-white" : "text-[#5E6654]")}>
                                {format(parsed, "EEE")}
                            </p>
                            <p className={cn("font-black text-base leading-tight sm:text-lg", today ? "text-white" : "text-[#20231A]")}>
                                {format(parsed, "d")}
                            </p>
                            <p className={cn("text-[9px] font-bold tracking-wide uppercase", today ? "text-white" : "text-[#5E6654]")}>
                                {format(parsed, "MMM")}
                            </p>
                        </div>

                        <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-1.5">
                                <p className="truncate font-black text-sm text-[#20231A]">{item.title}</p>
                                {today && <TonightBadge />}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-[#5E6654]">
                                <Clock className="h-3 w-3 shrink-0 opacity-50" />
                                {startEndTime}
                            </div>
                        </div>

                        {item.eventType && (
                            <span className={cn(
                                "hidden shrink-0 rounded-md px-2 py-0.5 text-[9px] font-bold tracking-wide whitespace-nowrap uppercase sm:inline-block",
                                badgeClass(item.eventType)
                            )}>
                                {badgeLabel(item.eventType)}
                            </span>
                        )}

                        <ChevronRight className="h-4 w-4 shrink-0 text-[#5E6654]/40 transition-colors group-hover:text-[#34451F]" />
                    </Link>
                );
            })}
        </div>
    );
}
