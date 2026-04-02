"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { updateBingoBookingStatus, refundBingoBooking } from "./actions";
import type { BingoBooking } from "./page";
import {
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  CreditCard,
  Users,
  Calendar,
  Mail,
  Phone,
  RefreshCw,
  Loader2,
  AlertCircle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const statusTheme = (status?: string, paymentStatus?: string) => {
  if (status === "cancelled") return { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", label: "Cancelled" };
  if (paymentStatus === "refunded") return { bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-600", label: "Refunded" };
  if (paymentStatus === "paid" && status === "confirmed") return { bg: "bg-green-50", border: "border-green-200", text: "text-green-700", label: "Confirmed & Paid" };
  if (paymentStatus === "paid") return { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", label: "Paid" };
  if (status === "waitlisted") return { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", label: "Waitlisted" };
  return { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", label: "Pending Payment" };
};

export default function BingoBookingListClient({
  bookings,
  selectedDate,
  filterStatus,
  filterPaymentStatus,
  filterFromDate,
  filterMinTotal
}: {
  bookings: BingoBooking[];
  selectedDate?: string;
  filterStatus?: string;
  filterPaymentStatus?: string;
  filterFromDate?: string;
  filterMinTotal?: string;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isFiltered = !!(filterStatus || filterPaymentStatus || filterFromDate || filterMinTotal !== undefined);
  const displayedBookings = isFiltered
    ? bookings.filter(b => {
        if (filterStatus && !filterStatus.split(",").includes(b.status ?? "")) return false;
        if (filterPaymentStatus && b.payment_status !== filterPaymentStatus) return false;
        if (filterFromDate && b.events?.event_date && b.events.event_date < filterFromDate) return false;
        if (filterMinTotal !== undefined && (b.total_amount ?? 0) <= Number(filterMinTotal)) return false;
        return true;
      })
    : bookings;

  const confirmed = bookings.filter(b => b.status === "confirmed" && b.payment_status === "paid").length;
  const pendingPayment = bookings.filter(b => b.payment_status === "unpaid").length;
  const cancelled = bookings.filter(b => b.status === "cancelled").length;

  const formatDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

  const handleStatus = (id: string, status: string) => {
    setError(null);
    setActiveId(id);
    startTransition(async () => {
      try {
        await updateBingoBookingStatus(id, status);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update");
      } finally {
        setActiveId(null);
      }
    });
  };

  const handleRefund = (id: string) => {
    if (!confirm("Process a refund for this booking? This will cancel it and attempt a refund via Square.")) return;
    setError(null);
    setActiveId(id);
    startTransition(async () => {
      try {
        await refundBingoBooking(id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Refund failed");
      } finally {
        setActiveId(null);
      }
    });
  };

  if (bookings.length === 0 && !isFiltered) {
    return (
      <div className="border-2 border-dashed border-[#E6DFC8] rounded-3xl py-16 text-center">
        <Calendar className="w-8 h-8 text-[#5F624F] opacity-20 mx-auto mb-3" />
        <p className="text-sm font-black text-[#1F1F1A]">No bingo bookings yet</p>
        {selectedDate && <p className="text-[11px] text-[#5F624F] mt-1">No bookings for this date</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Active filter banner */}
      {isFiltered && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-2xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">
            Filtered: {[filterStatus, filterPaymentStatus].filter(Boolean).join(" · ")}
            {" "}— {displayedBookings.length} result{displayedBookings.length !== 1 ? "s" : ""}
          </p>
          <Link
            href={`/events/bingo-bookings${selectedDate ? `?date=${selectedDate}` : ""}`}
            className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-amber-700 hover:text-amber-900"
            prefetch={false}
          >
            <X className="w-3 h-3" /> Clear
          </Link>
        </div>
      )}

      {/* Summary pills */}
      <div className="flex items-center gap-2 flex-wrap px-1">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#5F624F]">
          {bookings.length} booking{bookings.length !== 1 ? "s" : ""}
        </p>
        <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-green-50 border border-green-200 text-green-700">
          {confirmed} Confirmed
        </span>
        {pendingPayment > 0 && (
          <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700">
            {pendingPayment} Pending Payment
          </span>
        )}
        {cancelled > 0 && (
          <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-600">
            {cancelled} Cancelled
          </span>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 font-bold">{error}</p>
        </div>
      )}

      {displayedBookings.length === 0 && (
        <div className="border-2 border-dashed border-[#E6DFC8] rounded-3xl py-12 text-center">
          <Calendar className="w-8 h-8 text-[#5F624F] opacity-20 mx-auto mb-3" />
          <p className="text-sm font-black text-[#1F1F1A]">No bookings match this filter</p>
        </div>
      )}

      {displayedBookings.map((b) => {
        const theme = statusTheme(b.status, b.payment_status);
        const isExpanded = expandedId === b.id;
        const isLoading = isPending && activeId === b.id;
        const phone = [b.contacts?.country_code, b.contacts?.phone_no].filter(Boolean).join(" ");
        const table = b.booking_table_mappings?.[0]?.tables;

        return (
          <div
            key={b.id}
            className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden shadow-sm"
          >
            {/* Collapsed row */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : b.id)}
              className="w-full flex items-center gap-3 px-5 py-4 hover:bg-[#F7F4EA]/60 transition-colors text-left"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-black text-[#1F1F1A] text-sm">{b.contacts?.full_name ?? b.group_name ?? "—"}</p>
                  <span className={cn("text-[10px] font-black px-2 py-0.5 rounded-lg border", theme.bg, theme.border, theme.text)}>
                    {theme.label}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-[11px] text-[#5F624F] font-medium flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(b.events?.event_date)}
                  </span>
                  <span className="text-[11px] text-[#5F624F] font-medium flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {b.group_size} {b.group_size === 1 ? "person" : "people"}
                  </span>
                  <span className="text-[11px] text-[#5F624F] font-medium flex items-center gap-1">
                    <CreditCard className="w-3 h-3" />
                    £{(b.paid_amount ?? b.total_amount ?? 0).toFixed(2)}
                  </span>
                </div>
              </div>
              <ChevronRight className={cn("w-4 h-4 text-[#5F624F]/40 shrink-0 transition-transform", isExpanded && "rotate-90")} />
            </button>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="border-t-2 border-[#E6DFC8] px-5 py-4 space-y-4 animate-in fade-in duration-150">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  {b.contacts?.email && (
                    <div className="flex items-center gap-2 text-[#5F624F]">
                      <Mail className="w-3.5 h-3.5 shrink-0" />
                      <span className="font-medium text-[12px] truncate">{b.contacts.email}</span>
                    </div>
                  )}
                  {phone && (
                    <div className="flex items-center gap-2 text-[#5F624F]">
                      <Phone className="w-3.5 h-3.5 shrink-0" />
                      <span className="font-medium text-[12px]">{phone}</span>
                    </div>
                  )}
                  {table && (
                    <div className="flex items-center gap-2 text-[#5F624F]">
                      <Users className="w-3.5 h-3.5 shrink-0" />
                      <span className="font-medium text-[12px]">Table: {table.tables_name} (cap {table.tables_capacity})</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-[#5F624F]">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-medium text-[12px]">Booked {formatDate(b.booking_created_at)}</span>
                  </div>
                </div>

                {b.special_requests && (
                  <div className="bg-[#F7F4EA] rounded-2xl px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] mb-1">Special Requests</p>
                    <p className="text-sm text-[#1F1F1A] font-medium">{b.special_requests}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 flex-wrap pt-1">
                  {b.status !== "confirmed" && b.payment_status === "paid" && (
                    <button
                      onClick={() => handleStatus(b.id, "confirmed")}
                      disabled={isLoading}
                      className="flex items-center gap-1.5 h-10 px-4 rounded-xl bg-green-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-green-700 disabled:opacity-50"
                    >
                      {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      Confirm
                    </button>
                  )}
                  {b.status !== "cancelled" && (
                    <button
                      onClick={() => handleStatus(b.id, "cancelled")}
                      disabled={isLoading}
                      className="flex items-center gap-1.5 h-10 px-4 rounded-xl border-2 border-red-200 text-red-600 bg-red-50 text-[10px] font-black uppercase tracking-widest hover:bg-red-100 disabled:opacity-50"
                    >
                      {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                      Cancel
                    </button>
                  )}
                  {b.payment_status === "paid" && (
                    <button
                      onClick={() => handleRefund(b.id)}
                      disabled={isLoading}
                      className="flex items-center gap-1.5 h-10 px-4 rounded-xl border-2 border-[#E6DFC8] text-[#5F624F] bg-white text-[10px] font-black uppercase tracking-widest hover:bg-[#F7F4EA] disabled:opacity-50"
                    >
                      {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      Refund
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
