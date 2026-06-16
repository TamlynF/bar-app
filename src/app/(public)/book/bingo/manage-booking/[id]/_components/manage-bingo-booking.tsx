"use client";

import React, { useState, useTransition } from "react";
import {
  CalendarDays,
  Users,
  User,
  CreditCard,
  CheckCircle,
  XCircle,
  Loader2,
  Save,
  AlertCircle,
  MessageSquareQuote,
  Clock,
  Info,
} from "lucide-react";
import { cancelBooking } from "../../../../../_actions/cancel-booking";
import { updateBingoSpecialRequests } from "../actions";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";

export interface BingoManageBooking {
  id: string | number;
  status: string | null;
  payment_status: string | null;
  paid_amount: number | null;
  total_amount: number | null;
  group_name: string | null;
  group_size: number | null;
  special_requests: string | null;
  square_order_id: string | null;
  contacts: { full_name: string | null; email: string | null } | null;
  events: { event_date: string | null; event_title: string | null } | null;
  booking_table_mappings: {
    tables: { id: number; name: string; max_capacity: number } | null;
  }[] | null;
}

const labelClasses =
  "block text-[10px] font-black text-[#fdcc4b]/70 mb-2 uppercase tracking-[0.15em] ml-1";
const inputBaseClasses =
  "w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-4 text-white placeholder-stone-700 focus:outline-none focus:border-[#fdcc4b] focus:ring-1 focus:ring-[#fdcc4b] transition-all duration-300 text-sm font-bold resize-none";

function formatEventDate(dateStr: string | null) {
  if (!dateStr) return "TBD";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function StatusBanner({ status, paymentStatus }: { status: string | null; paymentStatus: string | null }) {
  const s = status?.toLowerCase();
  const p = paymentStatus?.toLowerCase();

  if (s === "cancelled") {
    return (
      <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-red-500/10 border border-red-500/20 mb-6">
        <XCircle className="w-5 h-5 text-red-400 shrink-0" />
        <span className="text-xs font-black text-red-400 uppercase tracking-widest">Booking Cancelled</span>
      </div>
    );
  }
  if (p === "refunded") {
    return (
      <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-stone-500/10 border border-stone-500/20 mb-6">
        <CreditCard className="w-5 h-5 text-stone-400 shrink-0" />
        <span className="text-xs font-black text-stone-400 uppercase tracking-widest">Refunded</span>
      </div>
    );
  }
  if (p === "paid" && s === "confirmed") {
    return (
      <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-6">
        <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
        <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">Confirmed &amp; Paid</span>
      </div>
    );
  }
  if (p === "paid") {
    return (
      <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 mb-6">
        <CreditCard className="w-5 h-5 text-blue-400 shrink-0" />
        <span className="text-xs font-black text-blue-400 uppercase tracking-widest">Paid</span>
      </div>
    );
  }
  if (s === "waitlisted") {
    return (
      <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-6">
        <Clock className="w-5 h-5 text-amber-400 shrink-0" />
        <span className="text-xs font-black text-amber-400 uppercase tracking-widest">On Waitlist</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-[#fdcc4b]/10 border border-[#fdcc4b]/20 mb-6">
      <Clock className="w-5 h-5 text-[#fdcc4b]/70 shrink-0" />
      <span className="text-xs font-black text-[#fdcc4b]/70 uppercase tracking-widest">Pending Payment</span>
    </div>
  );
}

export default function ManageBingoBooking({ booking }: { booking: BingoManageBooking }) {
  const [isPending, startTransition] = useTransition();
  const { confirm, ConfirmDialogUI } = useConfirm();
  const [isEditing, setIsEditing] = useState(false);
  const [specialRequests, setSpecialRequests] = useState(booking.special_requests ?? "");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const isCancelled =
    booking.status?.toLowerCase() === "cancelled" ||
    booking.payment_status?.toLowerCase() === "refunded";

  const table = booking.booking_table_mappings?.[0]?.tables;
  const amountPaid = booking.paid_amount ?? booking.total_amount ?? 0;

  const handleCancel = async () => {
    const ok = await confirm({
      title: "Cancel booking",
      description: "Are you sure you want to cancel this booking? Refunds are processed by our team — please allow 3–5 business days.",
      confirmLabel: "Cancel booking",
      variant: "destructive",
    });
    if (!ok) return;
    setError("");
    startTransition(async () => {
      const res = await cancelBooking(booking.id);
      if (!res.success) setError(res.error ?? "Failed to cancel booking.");
    });
  };

  const handleSave = () => {
    setError("");
    setSuccessMsg("");
    startTransition(async () => {
      const res = await updateBingoSpecialRequests(booking.id, specialRequests);
      if (res.success) {
        setSuccessMsg("Special requests updated.");
        setIsEditing(false);
      } else {
        setError(res.error ?? "Failed to save.");
      }
    });
  };

  return (
    <div className="w-full">
      {/* Status header */}
      <div className="text-center mb-8 animate-in fade-in duration-500">
        {isCancelled ? (
          <XCircle className="mx-auto h-16 w-16 text-red-500 mb-4 drop-shadow-[0_0_15px_rgba(239,68,68,0.3)]" />
        ) : (
          <CheckCircle className="mx-auto h-16 w-16 text-[#fdcc4b] mb-4 drop-shadow-[0_0_15px_rgba(253,204,75,0.3)]" />
        )}
        <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tighter uppercase leading-none">
          {isCancelled ? "Booking Cancelled" : isEditing ? "Edit Requests" : "Your Booking"}
        </h1>
        {!isEditing && (
          <p className="text-stone-500 mt-2 font-bold text-xs sm:text-sm uppercase tracking-widest">
            Ref: #{booking.id}
          </p>
        )}
      </div>

      {/* Status banner */}
      <StatusBanner status={booking.status} paymentStatus={booking.payment_status} />

      {/* Error / success feedback */}
      {error && (
        <div className="flex items-center gap-3 mb-6 bg-red-500/10 border border-red-500/20 p-4 rounded-2xl animate-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-red-400 text-xs font-bold uppercase tracking-tight">{error}</p>
        </div>
      )}
      {successMsg && !isEditing && (
        <div className="flex items-center justify-center gap-2 mb-6 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <p className="text-emerald-400 text-xs font-black uppercase tracking-widest">{successMsg}</p>
        </div>
      )}

      {/* Edit mode — special requests only */}
      {isEditing ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="space-y-1.5">
            <label className={labelClasses}>Special Requests</label>
            <textarea
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              rows={4}
              placeholder="Dietary requirements, accessibility needs..."
              className={cn(inputBaseClasses, "min-h-30")}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-3 pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="w-full flex items-center justify-center h-16 rounded-2xl bg-[#fdcc4b] hover:bg-[#e5b843] text-[#26300D] font-black text-lg uppercase tracking-widest transition-all shadow-[0_15px_30px_-5px_rgba(253,204,75,0.3)] active:scale-95 disabled:opacity-50"
            >
              {isPending ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Save className="w-6 h-6 mr-2" />Save Changes</>}
            </button>
            <button
              type="button"
              onClick={() => { setIsEditing(false); setSpecialRequests(booking.special_requests ?? ""); }}
              disabled={isPending}
              className="w-full h-14 rounded-2xl border-2 border-white/10 text-stone-400 font-black uppercase tracking-widest text-xs hover:bg-white/5 transition-all"
            >
              Discard Changes
            </button>
          </div>
        </div>
      ) : (
        /* View mode */
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="bg-white/5 rounded-3xl p-6 sm:p-8 border border-white/10 space-y-6 shadow-inner relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#fdcc4b]/5 blur-3xl pointer-events-none group-hover:bg-[#fdcc4b]/10 transition-colors" />

            <DetailRow
              icon={<CalendarDays />}
              label="Event Date"
              value={formatEventDate(booking.events?.event_date ?? null)}
            />
            <DetailRow
              icon={<User />}
              label="Table Name"
              value={booking.group_name ?? "—"}
            />
            <DetailRow
              icon={<Users />}
              label="People"
              value={`${booking.group_size ?? "—"} ${booking.group_size === 1 ? "person" : "people"}`}
            />
            <DetailRow
              icon={<User />}
              label="Booked By"
              value={booking.contacts?.full_name ?? "—"}
            />
            <DetailRow
              icon={<CreditCard />}
              label="Amount Paid"
              value={`£${amountPaid.toFixed(2)}`}
            />
            {table && (
              <DetailRow
                icon={<Users />}
                label="Table"
                value={`${table.name} (seats ${table.max_capacity})`}
              />
            )}
            {booking.special_requests && (
              <DetailRow
                icon={<MessageSquareQuote />}
                label="Special Requests"
                value={booking.special_requests}
              />
            )}
          </div>

          {!isCancelled && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                disabled={isPending}
                className="flex items-center justify-center w-full h-16 rounded-2xl bg-[#fdcc4b] text-[#26300D] font-black text-sm uppercase tracking-widest transition-all hover:bg-[#e5b843] hover:-translate-y-0.5 shadow-lg active:scale-95 disabled:opacity-50"
              >
                Edit Special Requests
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={isPending}
                className="flex items-center justify-center w-full h-16 rounded-2xl border-2 border-red-500/30 text-red-500 font-black text-xs uppercase tracking-widest transition-all hover:bg-red-500 hover:text-white hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
              >
                {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Cancel Booking"}
              </button>
              {booking.payment_status === "paid" && (
                <div className="flex items-start gap-2 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                  <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-400 font-bold leading-snug">
                    If you cancel, refunds are processed by our team. Please allow 3–5 business days.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="text-center">
            <p className="text-[9px] font-black text-stone-600 uppercase tracking-[0.4em] opacity-40">
              Booking Management Portal
            </p>
          </div>
        </div>
      )}
      {ConfirmDialogUI}
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start">
      <div className="bg-[#26300D] p-3 rounded-2xl mr-4 border border-[#fdcc4b]/20 text-[#fdcc4b] shrink-0 shadow-lg">
        {React.isValidElement(icon)
          ? React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: "w-5 h-5" })
          : icon}
      </div>
      <div className="text-left min-w-0 pt-1">
        <p className="text-[10px] font-black text-[#fdcc4b]/50 uppercase tracking-[0.15em] mb-0.5 leading-none">{label}</p>
        <p className="text-white font-black text-lg sm:text-xl tracking-tight leading-tight wrap-break-word">{value}</p>
      </div>
    </div>
  );
}
