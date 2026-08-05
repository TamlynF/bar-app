"use client";

import React, { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import BookingList, { STATUS_ORDER, STATUS_STYLES, type GeneralBooking } from "./booking-list";
import EventPickerBanner, { type EventItem } from "./event-filter";

export interface EventSummary {
  eventId: string;
  title: string;
  isActive: boolean;
  dateLabel: string;
  timeLabel: string;
  hostName: string;
  paymentAmount: number | null;
  totalExpected: number;
  totalPaid: number;
  seatingRequired: boolean;
  seated: { assigned: number; total: number } | null;
  quiz?: { status: string; count: number; total: number } | null;
}

const FIELD_LABEL = "text-[11px] font-semibold text-[#5E6654]";

const ALL_TAB = "all";

export default function BookingsSection({
  bookings,
  summary,
  events,
  selectedEventId,
  todayIso,
  showEventPicker = true,
  initialStatuses = [],
  initialSelectedId = null,
}: {
  bookings: GeneralBooking[];
  summary: EventSummary | null;
  events: EventItem[];
  selectedEventId: string | null;
  todayIso: string;
  showEventPicker?: boolean;
  initialStatuses?: string[];
  initialSelectedId?: string | null;
}) {
  const seededTab = initialStatuses
    .map(s => s.trim().toLowerCase())
    .find(s => (STATUS_ORDER as readonly string[]).includes(s));

  const [statusTab, setStatusTab] = useState<string>(seededTab ?? ALL_TAB);
  const [searchQuery, setSearchQuery] = useState("");

  const counts = useMemo(() => {
    const result: Record<string, number> = { [ALL_TAB]: bookings.length };
    for (const key of STATUS_ORDER) {
      result[key] = bookings.filter(b => (b.status || "").trim().toLowerCase() === key).length;
    }
    return result;
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return bookings.filter(b => {
      const matchesStatus = statusTab === ALL_TAB || (b.status || "").trim().toLowerCase() === statusTab;
      return (
        matchesStatus &&
        (q === "" ||
          (b.group_name || "").toLowerCase().includes(q) ||
          (b.contacts?.full_name || "").toLowerCase().includes(q))
      );
    });
  }, [bookings, statusTab, searchQuery]);

  const totalGuests = bookings.reduce((acc, b) => acc + (Number(b.group_size) || 0), 0);
  const seatingRequired = summary
    ? summary.seatingRequired
    : bookings.some(b => b.events?.seating_required !== false);
  const showPayment = summary
    ? Number(summary.paymentAmount) > 0 || summary.totalExpected > 0
    : bookings.some(b => Number(b.events?.event_payment_amount) > 0 || Number(b.total_amount) > 0);

  const tabs = [
    { key: ALL_TAB, label: "Everything" },
    ...STATUS_ORDER.map(key => ({ key: key as string, label: STATUS_STYLES[key].label })),
  ];

  return (
    <div
      className="space-y-3.5"
      style={
        { "--booking-list-reserve": showEventPicker ? "22rem" : "19rem" } as React.CSSProperties
      }
    >
      <EventPickerBanner
        events={events}
        selectedEventId={selectedEventId}
        todayIso={todayIso}
        summary={summary}
        stats={{ bookings: bookings.length, guests: totalGuests }}
        showPicker={showEventPicker}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="no-scrollbar -mx-3 flex w-[calc(100%+1.5rem)] items-center gap-2 overflow-x-auto px-3 sm:mx-0 sm:w-auto sm:flex-wrap sm:overflow-visible sm:px-0">
          <span className={cn(FIELD_LABEL, "shrink-0")}>Step 2 · Show me</span>
          {tabs.map(tab => {
            const active = statusTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                aria-pressed={active}
                onClick={() => setStatusTab(tab.key)}
                className={cn(
                  "h-11 shrink-0 rounded-[10px] px-3.5 text-[13px] font-semibold transition-colors sm:h-9.5",
                  active
                    ? "bg-[#34451F] text-white"
                    : "border border-[#D8D5C8] bg-white text-[#5E6654] hover:bg-[#F4F1E8]",
                )}
              >
                {tab.label} <span className="tabular-nums">({counts[tab.key] ?? 0})</span>
              </button>
            );
          })}
        </div>
        <div className="flex h-11 w-full items-center gap-2 rounded-[10px] border border-[#D8D5C8] bg-white px-3 focus-within:border-[#34451F] sm:ml-auto sm:h-9.5 sm:w-auto">
          <Search className="h-4 w-4 shrink-0 text-[#5E6654]" />
          <input
            type="text"
            aria-label="Find a booking by team or contact name"
            placeholder="Find a name…"
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[#20231A] outline-none placeholder:font-normal placeholder:text-[#5E6654] sm:w-37.5 sm:flex-none"
          />
        </div>
      </div>

      <BookingList
        bookings={filteredBookings}
        showEventColumn={!summary}
        seatingRequired={seatingRequired}
        showPayment={showPayment}
        initialSelectedId={initialSelectedId}
      />

      <p className="text-xs leading-snug font-medium text-[#5E6654]">
        Click any row to open its full details right underneath it.
      </p>
    </div>
  );
}
