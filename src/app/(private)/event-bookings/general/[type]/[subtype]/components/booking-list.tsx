"use client";

import React, { useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { CalendarDays, ChevronDown, ExternalLink, Mail, Phone, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface TableRow {
  tables_id: string;
  tables_name?: string;
  tables_capacity?: number;
}

interface ContactRow {
  full_name?: string;
  email?: string;
  country_code?: string;
  phone_no?: string;
}

interface EventRow {
  event_date?: string;
  event_title?: string | null;
  event_payment_amount?: number | null;
}

export interface GeneralBooking {
  id: string;
  event_id?: string;
  group_name?: string | null;
  group_size?: number | null;
  status?: string | null;
  payment_status?: string | null;
  paid_amount?: number | null;
  total_amount?: number | null;
  special_requests?: string | null;
  booking_created_at?: string;
  contacts?: ContactRow | null;
  events?: EventRow;
  booking_table_mappings?: { tables?: TableRow | null }[];
}

const STATUS_TABS = ["All", "Confirmed", "Waitlisted", "Pending", "Cancelled"] as const;

function statusBadge(status?: string | null) {
  switch (status) {
    case "confirmed":  return "bg-green-100 text-green-700 border border-green-200";
    case "waitlisted": return "bg-amber-100 text-amber-700 border border-amber-200";
    case "pending":    return "bg-blue-100 text-blue-700 border border-blue-200";
    case "cancelled":  return "bg-[#F7F4EA] text-[#5F624F] border border-[#E6DFC8]";
    default:           return "bg-[#F7F4EA] text-[#5F624F] border border-[#E6DFC8]";
  }
}

export default function BookingList({ bookings }: { bookings: GeneralBooking[] }) {
  const [activeTab, setActiveTab] = useState("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const tabCounts = Object.fromEntries(
    STATUS_TABS.map(t => [
      t,
      t === "All"
        ? bookings.length
        : bookings.filter(b => b.status?.toLowerCase() === t.toLowerCase()).length,
    ])
  );

  const visibleTabs = STATUS_TABS.filter(t => t === "All" || tabCounts[t] > 0);

  const filtered = activeTab === "All"
    ? bookings
    : bookings.filter(b => b.status?.toLowerCase() === activeTab.toLowerCase());

  if (bookings.length === 0) {
    return (
      <div className="bg-white border border-[#E6DFC8] rounded-2xl p-10 text-center">
        <CalendarDays className="w-8 h-8 text-[#5F624F] opacity-20 mx-auto mb-3" />
        <p className="text-sm font-black text-[#1F1F1A]">No bookings</p>
        <p className="text-[11px] text-[#5F624F] opacity-60 mt-1">Select an event above to filter bookings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Status tabs */}
      <div className="flex flex-wrap gap-1.5">
        {visibleTabs.map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide transition-colors",
              activeTab === tab
                ? "bg-[#5C4033] text-white"
                : "bg-[#F7F4EA] text-[#5F624F] hover:bg-[#E6DFC8]"
            )}
          >
            {tab}
            {tabCounts[tab] > 0 && (
              <span className="ml-1 opacity-60">({tabCounts[tab]})</span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-[#E6DFC8] rounded-2xl p-6 text-center">
          <p className="text-[11px] font-bold text-[#5F624F] uppercase tracking-wide opacity-60">
            No {activeTab.toLowerCase()} bookings
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(b => {
            const isExpanded = expandedId === b.id;
            const tables = (b.booking_table_mappings ?? [])
              .map(m => m.tables?.tables_name)
              .filter(Boolean)
              .join(", ");
            const eventDate = b.events?.event_date
              ? format(parseISO(b.events.event_date), "EEE d MMM yyyy")
              : null;

            return (
              <div key={b.id} className="bg-white border border-[#E6DFC8] rounded-2xl overflow-hidden">
                {/* Summary row */}
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : b.id)}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-[#F7F4EA] transition-colors"
                >
                  <span className={cn(
                    "text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-md whitespace-nowrap shrink-0",
                    statusBadge(b.status)
                  )}>
                    {b.status ?? "–"}
                  </span>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-[#1F1F1A] truncate">{b.group_name || "–"}</p>
                    {b.contacts?.full_name && (
                      <p className="text-[11px] text-[#5F624F] font-medium truncate">{b.contacts.full_name}</p>
                    )}
                  </div>

                  {b.group_size != null && (
                    <span className="hidden sm:flex items-center gap-1 text-[10px] font-bold text-[#5F624F] opacity-60 shrink-0">
                      <Users className="w-3 h-3" />
                      {b.group_size}
                    </span>
                  )}

                  {tables && (
                    <span className="hidden sm:block text-[10px] font-bold text-[#5F624F] opacity-60 shrink-0 max-w-[80px] truncate">
                      {tables}
                    </span>
                  )}

                  {eventDate && (
                    <span className="hidden md:block text-[10px] font-bold text-[#5F624F] opacity-60 shrink-0 whitespace-nowrap">
                      {eventDate}
                    </span>
                  )}

                  <ChevronDown className={cn(
                    "w-4 h-4 text-[#5F624F] opacity-40 shrink-0 transition-transform",
                    isExpanded && "rotate-180"
                  )} />
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-[#E6DFC8] space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {b.contacts?.email && (
                        <div className="flex items-center gap-1.5 min-w-0 col-span-2 sm:col-span-1">
                          <Mail className="w-3 h-3 text-[#5F624F] opacity-50 shrink-0" />
                          <span className="text-[11px] text-[#5F624F] truncate">{b.contacts.email}</span>
                        </div>
                      )}
                      {b.contacts?.phone_no && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-[#5F624F] opacity-50 shrink-0" />
                          <span className="text-[11px] text-[#5F624F]">
                            {b.contacts.country_code} {b.contacts.phone_no}
                          </span>
                        </div>
                      )}
                      {b.group_size != null && (
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3 h-3 text-[#5F624F] opacity-50 shrink-0" />
                          <span className="text-[11px] text-[#5F624F]">{b.group_size} guests</span>
                        </div>
                      )}
                      {tables && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-[#5F624F] opacity-50">Table</p>
                          <p className="text-[11px] font-bold text-[#1F1F1A]">{tables}</p>
                        </div>
                      )}
                      {(b.paid_amount != null || b.total_amount != null) && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-[#5F624F] opacity-50">Payment</p>
                          <p className="text-[11px] font-bold text-[#1F1F1A]">
                            £{(b.paid_amount ?? 0).toFixed(2)}
                            <span className="text-[#5F624F] font-normal"> / £{(b.total_amount ?? 0).toFixed(2)}</span>
                          </p>
                        </div>
                      )}
                      {b.payment_status && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-[#5F624F] opacity-50">Pay Status</p>
                          <p className="text-[11px] font-bold text-[#1F1F1A] capitalize">{b.payment_status}</p>
                        </div>
                      )}
                    </div>

                    {b.special_requests && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[#5F624F] opacity-50 mb-0.5">
                          Special Requests
                        </p>
                        <p className="text-[11px] text-[#5F624F] italic">{b.special_requests}</p>
                      </div>
                    )}

                    {b.event_id && (
                      <Link
                        href={`/event-bookings/event/${b.event_id}`}
                        className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-[#5C4033] hover:opacity-70 transition-opacity"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Manage Event
                      </Link>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
