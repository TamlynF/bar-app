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
      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4">
        <XCircle className="h-5 w-5 shrink-0 text-red-400" />
        <span className="font-black text-xs tracking-widest text-red-400 uppercase">Booking Cancelled</span>
      </div>
    );
  }
  if (p === "refunded") {
    return (
      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-stone-500/20 bg-stone-500/10 px-5 py-4">
        <CreditCard className="h-5 w-5 shrink-0 text-stone-400" />
        <span className="font-black text-xs tracking-widest text-stone-400 uppercase">Refunded</span>
      </div>
    );
  }
  if (p === "paid" && s === "confirmed") {
    return (
      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4">
        <CheckCircle className="h-5 w-5 shrink-0 text-emerald-400" />
        <span className="font-black text-xs tracking-widest text-emerald-400 uppercase">Confirmed &amp; Paid</span>
      </div>
    );
  }
  if (p === "paid") {
    return (
      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/10 px-5 py-4">
        <CreditCard className="h-5 w-5 shrink-0 text-blue-400" />
        <span className="font-black text-xs tracking-widest text-blue-400 uppercase">Paid</span>
      </div>
    );
  }
  if (s === "waitlisted") {
    return (
      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-5 py-4">
        <Clock className="h-5 w-5 shrink-0 text-amber-400" />
        <span className="font-black text-xs tracking-widest text-amber-400 uppercase">On Waitlist</span>
      </div>
    );
  }
  return (
    <div className="mb-6 flex items-center gap-3 rounded-2xl border border-[#fdcc4b]/20 bg-[#fdcc4b]/10 px-5 py-4">
      <Clock className="h-5 w-5 shrink-0 text-[#fdcc4b]/70" />
      <span className="font-black text-xs tracking-widest text-[#fdcc4b]/70 uppercase">Pending Payment</span>
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
      description: "Are you sure you want to cancel this booking? Refunds are processed by our team - please allow 3–5 business days.",
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
      <div className="mb-8 animate-in text-center duration-500 fade-in">
        {isCancelled ? (
          <XCircle className="mx-auto mb-4 h-16 w-16 text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.3)]" />
        ) : (
          <CheckCircle className="mx-auto mb-4 h-16 w-16 text-[#fdcc4b] drop-shadow-[0_0_15px_rgba(253,204,75,0.3)]" />
        )}
        <h1 className="font-black text-2xl leading-none tracking-tighter text-white uppercase sm:text-4xl">
          {isCancelled ? "Booking Cancelled" : isEditing ? "Edit Requests" : "Your Booking"}
        </h1>
        {!isEditing && (
          <p className="mt-2 text-xs font-bold tracking-widest text-stone-500 uppercase sm:text-sm">
            Ref: #{booking.id}
          </p>
        )}
      </div>

      <StatusBanner status={booking.status} paymentStatus={booking.payment_status} />

      {error && (
        <div className="mb-6 flex animate-in items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 slide-in-from-top-2">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
          <p className="text-xs font-bold tracking-tight text-red-400 uppercase">{error}</p>
        </div>
      )}
      {successMsg && !isEditing && (
        <div className="mb-6 flex animate-in items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 fade-in">
          <CheckCircle className="h-4 w-4 text-emerald-400" />
          <p className="font-black text-xs tracking-widest text-emerald-400 uppercase">{successMsg}</p>
        </div>
      )}

      {isEditing ? (
        <div className="animate-in space-y-6 duration-300 fade-in slide-in-from-bottom-4">
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
              className="flex h-16 w-full items-center justify-center rounded-2xl bg-[#fdcc4b] font-black text-lg tracking-widest text-[#26300D] uppercase shadow-[0_15px_30px_-5px_rgba(253,204,75,0.3)] transition-all hover:bg-[#e5b843] active:scale-95 disabled:opacity-50"
            >
              {isPending ? <Loader2 className="h-6 w-6 animate-spin" /> : <><Save className="mr-2 h-6 w-6" />Save Changes</>}
            </button>
            <button
              type="button"
              onClick={() => { setIsEditing(false); setSpecialRequests(booking.special_requests ?? ""); }}
              disabled={isPending}
              className="h-14 w-full rounded-2xl border-2 border-white/10 font-black text-xs tracking-widest text-stone-400 uppercase transition-all hover:bg-white/5"
            >
              Discard Changes
            </button>
          </div>
        </div>
      ) : (
        <div className="animate-in space-y-8 duration-500 fade-in">
          <div className="group relative space-y-6 overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-inner sm:p-8">
            <div className="pointer-events-none absolute top-0 right-0 h-32 w-32 bg-[#fdcc4b]/5 blur-3xl transition-colors group-hover:bg-[#fdcc4b]/10" />

            <DetailRow
              icon={<CalendarDays />}
              label="Event Date"
              value={formatEventDate(booking.events?.event_date ?? null)}
            />
            <DetailRow
              icon={<User />}
              label="Table Name"
              value={booking.group_name ?? "-"}
            />
            <DetailRow
              icon={<Users />}
              label="People"
              value={`${booking.group_size ?? "-"} ${booking.group_size === 1 ? "person" : "people"}`}
            />
            <DetailRow
              icon={<User />}
              label="Booked By"
              value={booking.contacts?.full_name ?? "-"}
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
                className="flex h-16 w-full items-center justify-center rounded-2xl bg-[#fdcc4b] font-black text-sm tracking-widest text-[#26300D] uppercase shadow-lg transition-all hover:-translate-y-0.5 hover:bg-[#e5b843] active:scale-95 disabled:opacity-50"
              >
                Edit Special Requests
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={isPending}
                className="flex h-16 w-full items-center justify-center rounded-2xl border-2 border-red-500/30 font-black text-xs tracking-widest text-red-500 uppercase transition-all hover:-translate-y-0.5 hover:bg-red-500 hover:text-white active:scale-95 disabled:opacity-50"
              >
                {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Cancel Booking"}
              </button>
              {booking.payment_status === "paid" && (
                <div className="flex items-start gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <p className="text-[11px] leading-snug font-bold text-amber-400">
                    If you cancel, refunds are processed by our team. Please allow 3–5 business days.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="text-center">
            <p className="font-black text-[9px] tracking-[0.4em] text-stone-600 uppercase opacity-40">
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
      <div className="mr-4 shrink-0 rounded-2xl border border-[#fdcc4b]/20 bg-[#26300D] p-3 text-[#fdcc4b] shadow-lg">
        {React.isValidElement(icon)
          ? React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: "w-5 h-5" })
          : icon}
      </div>
      <div className="min-w-0 pt-1 text-left">
        <p className="mb-0.5 font-black text-[10px] leading-none tracking-[0.15em] text-[#fdcc4b]/50 uppercase">{label}</p>
        <p className="font-black text-lg leading-tight tracking-tight wrap-break-word text-white sm:text-xl">{value}</p>
      </div>
    </div>
  );
}
