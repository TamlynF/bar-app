"use client";

import React, { useState } from "react";
import Link from "next/link";
import { format, isToday, parseISO } from "date-fns";
import { ChevronRight, Clock, User, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export type EventTypeRow = { type: string; sub_type: string } | null;

export type QuizDetails = {
    confirmedTeams: number;
    waitlistedTeams: number;
    pendingTeams: number;
    questionsGenerated: number;
    questionsTarget: number;
    tablesAssigned: boolean;
    capacityPct: number;
};

export type BingoDetails = {
    capacityPct: number;
    pricePerPerson: number | null;
    totalPaid: number;
    totalOutstanding: number;
    tablesAssigned: boolean;
};

export type PrivateDetails = {
    email: string;
    phone: string | null;
    guestCount: number;
    capacityPct: number;
    depositAmount: number | null;
    outstanding: number | null;
    reasonForHire: string;
};

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
    quizDetails?: QuizDetails;
    bingoDetails?: BingoDetails;
    privateDetails?: PrivateDetails;
};

function badgeClass(eventType: EventTypeRow): string {
    if (!eventType) return "";
    const t = `${eventType.sub_type} ${eventType.type}`.toLowerCase();
    if (t.includes("quiz")) return "bg-amber-100 text-amber-700 border border-amber-200";
    if (t.includes("band") || t.includes("music")) return "bg-purple-100 text-purple-700 border border-purple-200";
    if (t.includes("private") || t.includes("hire")) return "bg-blue-100 text-blue-700 border border-blue-200";
    if (t.includes("bingo")) return "bg-green-100 text-green-700 border border-green-200";
    return "bg-[#F7F4EA] text-[#5F624F] border border-[#E6DFC8]";
}

function badgeLabel(eventType: EventTypeRow): string {
    const raw = eventType?.sub_type || eventType?.type || "";
    return raw.charAt(0).toUpperCase() + raw.slice(1).replace(/-/g, " ");
}

export function EventRowListClient({ items }: { items: ListItem[] }) {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    if (items.length === 0) return null;

    return (
        <div className="bg-white border border-[#E6DFC8] rounded-2xl overflow-hidden flex flex-col">
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
                            className="event-row-grid w-full text-left grid gap-4 items-center p-4 hover:bg-[#F9F8F4] transition-colors cursor-pointer"
                        >
                            {/* Date pill */}
                            <div className={cn(
                                "w-14 text-center rounded-xl py-2 mr-px",
                                today ? "bg-[#FDCC4B]" : "bg-[#F7F4EA]"
                            )}>
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

                                {/* Col 2 — title + time */}
                                <div className="min-w-0 flex flex-col gap-1 items-start">
                                    <p className="text-sm font-black text-[#1F1F1A] truncate">{item.title}</p>
                                    <div className="flex items-center gap-1 text-[11px] text-[#5F624F] font-medium">
                                        <Clock className="w-3 h-3 opacity-50 shrink-0" />
                                        {startEndTime}
                                    </div>
                                </div>
                                

                                {/* Col 3 — event type + host */}
                                <div className="min-w-0 flex flex-col gap-1 items-start">
                                    {item.eventType && (
                                        <span className={cn(
                                            "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md whitespace-nowrap",
                                            badgeClass(item.eventType)
                                        )}>
                                            {badgeLabel(item.eventType)}
                                        </span>
                                    )}
                                    <div className="flex items-center gap-1 text-[11px] text-[#5F624F] font-medium">
                                        <User className="w-3 h-3 opacity-50 shrink-0" />
                                        <span className="truncate">{item.hostName || "–"}</span>
                                    </div>
                                </div>

                                {/* Col 4 — guests */}
                                <div className="flex flex-col gap-1 items-start">
                                    {item.guests > 0 ? (
                                        <>
                                            <p className="text-sm font-black text-[#1F1F1A] tabular-nums">{item.guests}</p>
                                            <p className="text-[9px] font-bold text-[#5F624F] uppercase tracking-wider">guests</p>
                                        </>
                                    ) : (
                                        <p className="text-[9px] text-[#5F624F]/30">–</p>
                                    )}
                                </div>
                            

                            {/* Chevron */}
                            <ChevronRight className={cn("w-4 h-4 text-[#5F624F]/40 justify-self-end transition-transform", isExpanded && "rotate-90")} />
                        </button>

                        {/* Expanded details */}
                        {isExpanded && (
                            <div className="bg-yellow-50 border-t-2 border-[#fdcc4b] px-5 py-4 animate-in fade-in duration-150">
                                {item.quizDetails ? (
                                    /* ── Quiz-specific expanded view ── */
                                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                        <div className="space-y-3 flex-1">
                                            {/* Quiz completeness badge */}
                                            {(() => {
                                                const qd = item.quizDetails;
                                                const complete = qd.questionsTarget > 0 && qd.questionsGenerated >= qd.questionsTarget;
                                                return (
                                                    <span className={cn(
                                                        "inline-flex items-center text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md border",
                                                        complete
                                                            ? "bg-green-100 text-green-700 border-green-200"
                                                            : "bg-red-100 text-red-600 border-red-200"
                                                    )}>
                                                        Quiz: {complete ? "Complete" : "Incomplete"}
                                                    </span>
                                                );
                                            })()}

                                            {/* Capacity bar */}
                                            <div className="space-y-1">
                                                <div className="flex items-center justify-between text-[10px] text-[#5F624F] font-medium">
                                                    <span>Capacity</span>
                                                    <span className="font-black text-[#1F1F1A]">{item.quizDetails.capacityPct}%</span>
                                                </div>
                                                <div className="h-1.5 bg-[#E6DFC8] rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-[#FDCC4B] rounded-full transition-all"
                                                        style={{ width: `${Math.min(item.quizDetails.capacityPct, 100)}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Teams */}
                                            <div className="flex items-center gap-3 text-[11px] text-[#5F624F] font-medium flex-wrap">
                                                <span><span className="font-black text-[#1F1F1A]">{item.quizDetails.confirmedTeams}</span> confirmed</span>
                                                {item.quizDetails.waitlistedTeams > 0 && (
                                                    <><span className="opacity-30">·</span><span><span className="font-black text-[#1F1F1A]">{item.quizDetails.waitlistedTeams}</span> waitlisted</span></>
                                                )}
                                                {item.quizDetails.pendingTeams > 0 && (
                                                    <><span className="opacity-30">·</span><span><span className="font-black text-[#1F1F1A]">{item.quizDetails.pendingTeams}</span> pending</span></>
                                                )}
                                                <span className="opacity-30">·</span>
                                                <span className="text-[10px]">teams</span>
                                            </div>

                                            {/* Tables */}
                                            <div className={cn(
                                                "text-[11px] font-medium",
                                                item.quizDetails.tablesAssigned ? "text-green-700" : "text-amber-600"
                                            )}>
                                                {item.quizDetails.tablesAssigned
                                                    ? "✓ All tables assigned"
                                                    : "⚠ Tables not fully assigned"}
                                            </div>
                                        </div>

                                        <Link
                                            href={item.href}
                                            className="flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-[#26300D] text-[#FDCC4B] text-[10px] font-black uppercase tracking-widest hover:bg-[#26300D]/90 transition-colors shrink-0"
                                        >
                                            Manage Bookings <ChevronRight className="w-3.5 h-3.5" />
                                        </Link>
                                    </div>
                                ) : item.bingoDetails ? (
                                    /* ── Bingo-specific expanded view ── */
                                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                        <div className="space-y-3 flex-1">
                                            {/* Capacity bar */}
                                            <div className="space-y-1">
                                                <div className="flex items-center justify-between text-[10px] text-[#5F624F] font-medium">
                                                    <span>Capacity</span>
                                                    <span className="font-black text-[#1F1F1A]">{item.bingoDetails.capacityPct}%</span>
                                                </div>
                                                <div className="h-1.5 bg-[#E6DFC8] rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-[#FDCC4B] rounded-full transition-all"
                                                        style={{ width: `${Math.min(item.bingoDetails.capacityPct, 100)}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Financials */}
                                            <div className="grid grid-cols-3 gap-3 text-[11px]">
                                                {item.bingoDetails.pricePerPerson !== null && (
                                                    <div>
                                                        <p className="text-[#5F624F] font-medium">Per person</p>
                                                        <p className="font-black text-[#1F1F1A]">£{item.bingoDetails.pricePerPerson.toFixed(2)}</p>
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="text-[#5F624F] font-medium">Paid</p>
                                                    <p className="font-black text-green-700">£{item.bingoDetails.totalPaid.toFixed(2)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[#5F624F] font-medium">Outstanding</p>
                                                    <p className={cn("font-black", item.bingoDetails.totalOutstanding > 0 ? "text-amber-600" : "text-[#1F1F1A]")}>
                                                        £{item.bingoDetails.totalOutstanding.toFixed(2)}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Tables */}
                                            <div className={cn(
                                                "text-[11px] font-medium",
                                                item.bingoDetails.tablesAssigned ? "text-green-700" : "text-amber-600"
                                            )}>
                                                {item.bingoDetails.tablesAssigned
                                                    ? "✓ All tables assigned"
                                                    : "⚠ Tables not fully assigned"}
                                            </div>
                                        </div>

                                        <Link
                                            href={item.href}
                                            className="flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-[#26300D] text-[#FDCC4B] text-[10px] font-black uppercase tracking-widest hover:bg-[#26300D]/90 transition-colors shrink-0"
                                        >
                                            Manage Bookings <ChevronRight className="w-3.5 h-3.5" />
                                        </Link>
                                    </div>
                                ) : item.privateDetails ? (
                                    /* ── Private hire expanded view ── */
                                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                        <div className="space-y-3 flex-1">
                                            {/* Contact */}
                                            <div className="grid grid-cols-2 gap-3 text-[11px]">
                                                <div>
                                                    <p className="text-[#5F624F] font-medium">Email</p>
                                                    <p className="font-black text-[#1F1F1A] truncate">{item.privateDetails.email}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[#5F624F] font-medium">Phone</p>
                                                    <p className="font-black text-[#1F1F1A]">{item.privateDetails.phone || "–"}</p>
                                                </div>
                                            </div>

                                            {/* Capacity bar */}
                                            <div className="space-y-1">
                                                <div className="flex items-center justify-between text-[10px] text-[#5F624F] font-medium">
                                                    <span>Capacity ({item.privateDetails.guestCount} guests)</span>
                                                    <span className="font-black text-[#1F1F1A]">{item.privateDetails.capacityPct}%</span>
                                                </div>
                                                <div className="h-1.5 bg-[#E6DFC8] rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-[#FDCC4B] rounded-full transition-all"
                                                        style={{ width: `${Math.min(item.privateDetails.capacityPct, 100)}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Financials */}
                                            {(item.privateDetails.depositAmount !== null || item.privateDetails.outstanding !== null) && (
                                                <div className="grid grid-cols-2 gap-3 text-[11px]">
                                                    <div>
                                                        <p className="text-[#5F624F] font-medium">Deposit</p>
                                                        <p className="font-black text-[#1F1F1A]">
                                                            {item.privateDetails.depositAmount !== null ? `£${item.privateDetails.depositAmount.toFixed(2)}` : "–"}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[#5F624F] font-medium">Outstanding</p>
                                                        <p className={cn("font-black", item.privateDetails.outstanding && item.privateDetails.outstanding > 0 ? "text-amber-600" : "text-[#1F1F1A]")}>
                                                            {item.privateDetails.outstanding !== null ? `£${item.privateDetails.outstanding.toFixed(2)}` : "–"}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Reason */}
                                            <div>
                                                <p className="text-[10px] text-[#5F624F] font-medium mb-0.5">Reason for hire</p>
                                                <p className="text-[11px] text-[#1F1F1A] bg-[#F7F4EA] rounded-lg px-3 py-2">{item.privateDetails.reasonForHire}</p>
                                            </div>
                                        </div>

                                        <Link
                                            href={item.href}
                                            className="flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-[#26300D] text-[#FDCC4B] text-[10px] font-black uppercase tracking-widest hover:bg-[#26300D]/90 transition-colors shrink-0"
                                        >
                                            Manage Bookings <ChevronRight className="w-3.5 h-3.5" />
                                        </Link>
                                    </div>
                                ) : (
                                    /* ── Generic expanded view ── */
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
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
