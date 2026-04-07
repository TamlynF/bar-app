"use client";

import React, { useEffect, useRef, useState } from "react";

function CapacityBar({ pct }: { pct: number }) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        ref.current?.style.setProperty("--bar-width", `${Math.min(pct, 100)}%`);
    }, [pct]);
    return <div ref={ref} className="h-full bg-[#FDCC4B] rounded-full transition-all capacity-fill" />;
}
import Link from "next/link";
import { format, isToday, parseISO } from "date-fns";
import { ChevronDown, ChevronRight, ChevronUp, Clock, User, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export type EventTypeRow = { type: string; sub_type: string } | null;

export type TableCapacityGroup = { capacity: number; assigned: number; total: number };

export type QuizDetails = {
    confirmedTeams: number;
    waitlistedTeams: number;
    pendingTeams: number;
    questionsGenerated: number;
    questionsTarget: number;
    tablesAssigned: boolean;
    capacityPct: number;
    tableGroups: TableCapacityGroup[];
};

export type BingoDetails = {
    capacityPct: number;
    pricePerPerson: number | null;
    totalPaid: number;
    totalOutstanding: number;
    tablesAssigned: boolean;
    tableGroups: TableCapacityGroup[];
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

export type BandDetails = {
    bookerName: string;
    email: string;
    phone: string | null;
    actType: string | null;
    genre: string | null;
    paymentRequired: boolean;
    paymentAmount: number | null;
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
    bandDetails?: BandDetails;
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

function toTitleCase(str?: string | null) {
    if (!str) return "";
    return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
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
                    <div key={item.key} className={cn(
                        "transition-colors",
                        isExpanded
                            ? "mx-1 my-0.5 rounded-xl border-2 border-[#FDCC4B] overflow-hidden"
                            : "border-b border-[#E6DFC8] last:border-0 bg-white"
                    )}>
                        <button
                            type="button"
                            title="Event"
                            onClick={() => setExpandedId(isExpanded ? null : item.key)}
                            className={cn(
                                "w-full text-left flex  flex-row items-center gap-3 p-4 transition-colors cursor-pointer sm:event-row-desktop",
                                isExpanded ? "bg-[#FEF3C7]" : "hover:bg-yellow-100"
                            )}
                        >
                            {/* Date pill */}
                            <div className={cn(
                                "w-10 sm:w-14 text-center rounded-xl py-1.5 sm:py-2 shrink-0 self-center",
                                today ? "bg-[#FDCC4B]" : "bg-[#F7F4EA]"
                            )}>
                                <p className={cn("text-[8px] sm:text-[9px] font-black uppercase tracking-widest", today ? "text-[#26300D]" : "text-[#5F624F]")}>
                                    {format(parsed, "EEE")}
                                </p>
                                <p className={cn("text-base sm:text-xl font-black leading-tight", today ? "text-[#26300D]" : "text-[#1F1F1A]")}>
                                    {format(parsed, "d")}
                                </p>
                                <p className={cn("text-[8px] sm:text-[9px] font-black uppercase tracking-widest", today ? "text-[#26300D]" : "text-[#5F624F]")}>
                                    {format(parsed, "MMM")}
                                </p>
                            </div>

                            {/* ── Mobile layout (hidden sm+) ── */}
                            <div className="flex-1 min-w-0 flex flex-col gap-0.5 sm:hidden">
                                {/* Row 1: title only — constrained by the flex-col width */}
                                <p className="text-sm font-black text-[#1F1F1A] truncate">{item.title}</p>
                                {/* Row 2: time · host — spacer — badge — chevron */}
                                <div className="flex items-center gap-1.5">
                                    <Clock className="w-3 h-3 text-[#5F624F] opacity-50 shrink-0" />
                                    <span className="text-[11px] text-[#5F624F] font-medium shrink-0">{startEndTime}</span>
                                    {item.hostName && (
                                        <>
                                            <span className="text-[#5F624F]/30 shrink-0">·</span>
                                            <span className="text-[11px] text-[#5F624F] font-medium truncate min-w-0">{item.hostName}</span>
                                        </>
                                    )}
                                    <div className="flex-1" />
                                    {item.eventType && (
                                        <span className={cn(
                                            "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md whitespace-nowrap shrink-0",
                                            badgeClass(item.eventType)
                                        )}>
                                            {badgeLabel(item.eventType)}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* ── Desktop cols 2–5 (hidden on mobile) ── */}
                            {/* Col 2 — title + time */}
                            <div className="hidden sm:flex w-full flex-row gap-3 justify-between items-center">
                                <div className="flex-1 min-w-0 flex-col gap-1 items-start">
                                    <p className="text-sm font-black text-[#1F1F1A] truncate w-full">{item.title}</p>
                                    <div className="flex items-center gap-1 text-[11px] text-[#5F624F] font-medium">
                                        <Clock className="w-3 h-3 opacity-50 shrink-0" />
                                        {startEndTime}
                                    </div>
                                </div>

                                {/* Col 3 — badge + host */}
                                <div className="flex-1 min-w-0 flex-col gap-1 items-start">
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
                                <div className="flex-1 flex-col gap-1 items-start">
                                    {item.guests > 0 ? (
                                        <>
                                            <p className="text-sm font-black text-[#1F1F1A] tabular-nums">{item.guests}</p>
                                            <p className="text-[9px] font-bold text-[#5F624F] uppercase tracking-wider">guests</p>
                                        </>
                                    ) : (
                                        <p className="text-[9px] text-[#5F624F]/30">–</p>
                                    )}
                                </div>
                            </div>

                            {/* Col 5 — chevron (desktop only) */}
                            {isExpanded ? <ChevronUp className="w-4 h-4 shrink-0 transition-transform duration-200" /> : <ChevronDown className="w-4 h-4 shrink-0 transition-transform duration-200" />}
                        </button>

                        {/* Expanded details */}
                        {isExpanded && (
                            <div className="bg-yellow-50 border-t-2 border-[#fdcc4b] px-5 py-4 animate-in fade-in duration-150">
                                {/* Guest count — mobile only */}
                                {item.guests > 0 && (
                                    <div className="flex items-center gap-1.5 text-[11px] text-[#5F624F] font-medium mb-3 sm:hidden">
                                        <User className="w-3 h-3 opacity-50 shrink-0" />
                                        <span><span className="font-black text-[#1F1F1A]">{item.guests}</span> guests</span>
                                    </div>
                                )}
                                {item.quizDetails ? (
                                    /* ── Quiz-specific expanded view ── */
                                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                        <div className="space-y-3 flex-1">


                                            {/* Capacity bar */}
                                            <div className="space-y-1">
                                                <div className="flex items-center justify-between text-[10px] text-[#5F624F] font-medium">
                                                    <span>Capacity</span>
                                                    <span className="font-black text-[#1F1F1A]">{item.quizDetails.capacityPct}%</span>
                                                </div>
                                                <div className="h-2 bg-white border border-[#E6DFC8] rounded-full overflow-hidden">
                                                    <CapacityBar pct={item.quizDetails.capacityPct} />
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
                                            {item.quizDetails.tableGroups.length > 0 ? (
                                                <div className="space-y-1">
                                                    <p className="text-[10px] text-[#5F624F] font-medium uppercase tracking-widest">Tables</p>
                                                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                                                        {item.quizDetails.tableGroups.map(g => (
                                                            <div key={g.capacity} className="flex items-center gap-1.5 text-[11px]">
                                                                <span className="text-[#5F624F]">{g.capacity}-seat</span>
                                                                <span className={cn(
                                                                    "font-black",
                                                                    g.assigned === g.total ? "text-green-700"
                                                                    : g.assigned > 0 ? "text-amber-600"
                                                                    : "text-[#5F624F]/40"
                                                                )}>
                                                                    {g.assigned}/{g.total}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className={cn(
                                                    "text-[11px] font-medium",
                                                    item.quizDetails.tablesAssigned ? "text-green-700" : "text-amber-600"
                                                )}>
                                                    {item.quizDetails.tablesAssigned ? "✓ All tables assigned" : "⚠ Tables not fully assigned"}
                                                </div>
                                            )}

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
                                                <div className="h-2 bg-white border border-[#E6DFC8] rounded-full overflow-hidden">
                                                    <CapacityBar pct={item.bingoDetails.capacityPct} />
                                                </div>
                                            </div>

                                            {/* Financials */}
                                            <div className="flex flex-row justify-between w-full gap-3 text-[11px]">
                                                <div className="flex-1">
                                                    <p className="text-[#5F624F] font-medium">Per person</p>
                                                    <p className="font-black text-[#1F1F1A]">
                                                        {item.bingoDetails.pricePerPerson != null ? `£${item.bingoDetails.pricePerPerson.toFixed(2)}` : "£-"}
                                                    </p>
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-[#5F624F] font-medium">Paid</p>
                                                    <p className="font-black text-green-700">
                                                        {item.bingoDetails.totalPaid != null ? `£${item.bingoDetails.totalPaid.toFixed(2)}` : "£-"}
                                                    </p>
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-[#5F624F] font-medium">Outstanding</p>
                                                    <p className={cn("font-black", item.bingoDetails.totalOutstanding > 0 ? "text-amber-600" : "text-[#1F1F1A]")}>
                                                        {item.bingoDetails.totalOutstanding != null ? `£${item.bingoDetails.totalOutstanding.toFixed(2)}` : "£-"}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Tables */}
                                            {item.bingoDetails.tableGroups.length > 0 ? (
                                                <div className="space-y-1">
                                                    <p className="text-[10px] text-[#5F624F] font-medium uppercase tracking-widest">Tables</p>
                                                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                                                        {item.bingoDetails.tableGroups.map(g => (
                                                            <div key={g.capacity} className="flex items-center gap-1.5 text-[11px]">
                                                                <span className="text-[#5F624F]">{g.capacity}-seat</span>
                                                                <span className={cn(
                                                                    "font-black",
                                                                    g.assigned === g.total ? "text-green-700"
                                                                    : g.assigned > 0 ? "text-amber-600"
                                                                    : "text-[#5F624F]/40"
                                                                )}>
                                                                    {g.assigned}/{g.total}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className={cn(
                                                    "text-[11px] font-medium",
                                                    item.bingoDetails.tablesAssigned ? "text-green-700" : "text-amber-600"
                                                )}>
                                                    {item.bingoDetails.tablesAssigned ? "✓ All tables assigned" : "⚠ Tables not fully assigned"}
                                                </div>
                                            )}
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
                                                <div className="h-2 bg-white border border-[#E6DFC8] rounded-full overflow-hidden">
                                                    <CapacityBar pct={item.privateDetails.capacityPct} />
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
                                ) : item.bandDetails ? (
                                    /* ── Band-specific expanded view ── */
                                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                        <div className="space-y-3 flex-1">
                                            {/* Contact */}
                                            <div className="grid grid-cols-2 gap-3 text-[11px]">
                                                <div>
                                                    <p className="text-[#5F624F] font-medium">Booker</p>
                                                    <p className="font-black text-[#1F1F1A] truncate">{item.bandDetails.bookerName}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[#5F624F] font-medium">Phone</p>
                                                    <p className="font-black text-[#1F1F1A]">{item.bandDetails.phone || "–"}</p>
                                                </div>
                                                <div className="col-span-2">
                                                    <p className="text-[#5F624F] font-medium">Email</p>
                                                    <p className="font-black text-[#1F1F1A] truncate">{item.bandDetails.email}</p>
                                                </div>
                                            </div>

                                            {/* Act details */}
                                            <div className="grid grid-cols-2 gap-3 text-[11px]">
                                                {item.bandDetails.actType && (
                                                    <div>
                                                        <p className="text-[#5F624F] font-medium">Type</p>
                                                        <p className="font-black text-[#1F1F1A] capitalize">{toTitleCase(item.bandDetails.actType)}</p>
                                                    </div>
                                                )}
                                                {item.bandDetails.genre && (
                                                    <div>
                                                        <p className="text-[#5F624F] font-medium">Genre</p>
                                                        <p className="font-black text-[#1F1F1A] capitalize">{toTitleCase(item.bandDetails.genre)}</p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Payment */}
                                            <div className="grid grid-cols-2 gap-3 text-[11px]">
                                                <div>
                                                    <p className="text-[#5F624F] font-medium">Payment required</p>
                                                    <p className={cn("font-black", item.bandDetails.paymentRequired ? "text-amber-600" : "text-green-700")}>
                                                        {item.bandDetails.paymentRequired ? "Yes" : "No"}
                                                    </p>
                                                </div>
                                                {item.bandDetails.paymentAmount !== null && (
                                                    <div>
                                                        <p className="text-[#5F624F] font-medium">Amount</p>
                                                        <p className="font-black text-[#1F1F1A]">£{item.bandDetails.paymentAmount.toFixed(2)}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <Link
                                            href={item.href}
                                            className="flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-[#26300D] text-[#FDCC4B] text-[10px] font-black uppercase tracking-widest hover:bg-[#26300D]/90 transition-colors shrink-0"
                                        >
                                            View Booking <ChevronRight className="w-3.5 h-3.5" />
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
