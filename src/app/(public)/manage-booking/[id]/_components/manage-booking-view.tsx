"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import {
  CalendarDays,
  Users,
  User,
  Ticket,
  CreditCard,
  CheckCircle,
  XCircle,
  Clock3,
  Loader2,
  AlertCircle,
  MessageSquareQuote,
} from "lucide-react";
import { cancelBooking } from "@/app/(public)/_actions/cancel-booking";
import { useConfirm } from "@/components/ui/confirm-dialog";

export interface ManageEventBooking {
  id: string | number;
  group_name: string | null;
  group_size: number | null;
  status: string | null;
  payment_status: string | null;
  total_amount: number | null;
  paid_amount: number | null;
  special_requests: string | null;
  events: {
    event_title: string | null;
    event_date: string | null;
  } | null;
  contacts: {
    full_name: string | null;
    email: string | null;
  } | null;
}

export default function ManageBookingView({
  booking,
  isCancelled: initialCancelled,
}: {
  booking: ManageEventBooking;
  isCancelled: boolean;
}) {
  const { confirm, ConfirmDialogUI } = useConfirm();
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState("");
  const [isCancelled, setIsCancelled] = useState(initialCancelled);

  const eventDateStr = booking.events?.event_date;
  // Parse as local midnight to avoid timezone shifts (DB stores YYYY-MM-DD).
  const eventDate = eventDateStr ? new Date(eventDateStr + "T00:00:00") : null;
  const status = (booking.status || "").toLowerCase();
  const isPending = !isCancelled && status === "pending";
  const isUnpaid = booking.payment_status === "unpaid";

  const handleCancel = async () => {
    const ok = await confirm({
      title: "Cancel booking",
      description: "Are you sure you want to cancel this booking? This action cannot be undone.",
      confirmLabel: "Cancel booking",
      variant: "destructive",
    });
    if (!ok) return;

    setIsCancelling(true);
    setError("");

    const response = await cancelBooking(booking.id);
    if (response.success) {
      setIsCancelled(true);
    } else {
      setError(response.error || "Failed to cancel booking.");
    }
    setIsCancelling(false);
  };

  return (
    <div className="w-full">
      {/* STATUS HEADER */}
      <div className="text-center mb-8 animate-in fade-in duration-500">
        {isCancelled ? (
          <XCircle className="mx-auto h-16 w-16 text-red-500 mb-4 drop-shadow-[0_0_15px_rgba(239,68,68,0.3)]" />
        ) : isPending ? (
          <Clock3 className="mx-auto h-16 w-16 text-amber-400 mb-4 drop-shadow-[0_0_15px_rgba(251,191,36,0.3)]" />
        ) : (
          <CheckCircle className="mx-auto h-16 w-16 text-[#fdcc4b] mb-4 drop-shadow-[0_0_15px_rgba(253,204,75,0.3)]" />
        )}

        <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tighter uppercase leading-none">
          {isCancelled ? "Booking Cancelled" : "Your Booking"}
        </h1>
        <p className="text-stone-500 mt-2 font-bold text-xs sm:text-sm uppercase tracking-widest">
          Ref: #{booking.id}
        </p>
      </div>

      {/* ERROR */}
      {error && (
        <div className="flex items-center gap-3 mb-6 bg-red-500/10 border border-red-500/20 p-4 rounded-2xl animate-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-red-400 text-xs font-bold uppercase tracking-tight leading-snug">{error}</p>
        </div>
      )}

      {/* PENDING-PAYMENT NOTICE */}
      {isPending && isUnpaid && (
        <div className="flex items-start gap-3 mb-6 bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl animate-in slide-in-from-top-2">
          <Clock3 className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-amber-400 text-xs font-bold uppercase tracking-tight leading-snug">
            Payment not yet completed. If you didn&apos;t finish checkout, please rebook or contact the bar.
          </p>
        </div>
      )}

      {/* DETAILS */}
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="bg-white/5 rounded-3xl p-6 sm:p-8 border border-white/10 space-y-6 shadow-inner relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#fdcc4b]/5 blur-3xl pointer-events-none group-hover:bg-[#fdcc4b]/10 transition-colors" />

          <DetailRow icon={<Ticket />} label="Event" value={booking.events?.event_title || "Event"} />
          <DetailRow
            icon={<CalendarDays />}
            label="Date"
            value={eventDate ? format(eventDate, "do MMMM yyyy") : "TBD"}
          />
          <DetailRow icon={<Users />} label="Party Size" value={`${booking.group_size ?? 0} People`} />
          <DetailRow icon={<User />} label="Lead Booker" value={booking.contacts?.full_name || "N/A"} />
          {booking.total_amount != null && booking.total_amount > 0 && (
            <DetailRow
              icon={<CreditCard />}
              label={isUnpaid ? "Amount Due" : "Paid"}
              value={`£${Number(isUnpaid ? booking.total_amount : booking.paid_amount ?? 0).toFixed(2)}`}
            />
          )}
          {booking.special_requests && (
            <DetailRow icon={<MessageSquareQuote />} label="Special Requests" value={booking.special_requests} />
          )}
        </div>

        {!isCancelled && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={isCancelling}
            className="flex items-center justify-center w-full h-16 rounded-2xl border-2 border-red-500/30 text-red-500 font-black text-xs uppercase tracking-widest transition-all hover:bg-red-500 hover:text-white hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
          >
            {isCancelling ? <Loader2 className="w-5 h-5 animate-spin" /> : "Cancel Booking"}
          </button>
        )}

        <div className="text-center">
          <p className="text-[9px] font-black text-stone-600 uppercase tracking-[0.4em] opacity-40">
            Booking Management Portal
          </p>
        </div>
      </div>
      {ConfirmDialogUI}
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start">
      <div className="bg-[#26300D] p-3 rounded-2xl mr-4 border border-[#fdcc4b]/20 text-[#fdcc4b] shrink-0 shadow-lg">
        {React.isValidElement(icon)
          ? React.cloneElement(icon as React.ReactElement<{ className?: string }>, {
              className: "w-5 h-5",
            })
          : icon}
      </div>
      <div className="text-left min-w-0 pt-1">
        <p className="text-[10px] font-black text-[#fdcc4b]/50 uppercase tracking-[0.15em] mb-0.5 leading-none">{label}</p>
        <p className="text-white font-black text-lg sm:text-xl tracking-tight leading-tight whitespace-pre-wrap wrap-break-word">{value}</p>
      </div>
    </div>
  );
}
