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
      <div className="mb-8 animate-in text-center duration-500 fade-in">
        {isCancelled ? (
          <XCircle className="mx-auto mb-4 h-16 w-16 text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.3)]" />
        ) : isPending ? (
          <Clock3 className="mx-auto mb-4 h-16 w-16 text-amber-400 drop-shadow-[0_0_15px_rgba(251,191,36,0.3)]" />
        ) : (
          <CheckCircle className="mx-auto mb-4 h-16 w-16 text-[#fdcc4b] drop-shadow-[0_0_15px_rgba(253,204,75,0.3)]" />
        )}

        <h1 className="font-black text-2xl leading-none tracking-tighter text-white uppercase sm:text-4xl">
          {isCancelled ? "Booking Cancelled" : "Your Booking"}
        </h1>
        <p className="mt-2 text-xs font-bold tracking-widest text-stone-500 uppercase sm:text-sm">
          Ref: #{booking.id}
        </p>
      </div>

      {/* ERROR */}
      {error && (
        <div className="mb-6 flex animate-in items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 slide-in-from-top-2">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
          <p className="text-xs leading-snug font-bold tracking-tight text-red-400 uppercase">{error}</p>
        </div>
      )}

      {/* PENDING-PAYMENT NOTICE */}
      {isPending && isUnpaid && (
        <div className="mb-6 flex animate-in items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 slide-in-from-top-2">
          <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <p className="text-xs leading-snug font-bold tracking-tight text-amber-400 uppercase">
            Payment not yet completed. If you didn&apos;t finish checkout, please rebook or contact the bar.
          </p>
        </div>
      )}

      {/* DETAILS */}
      <div className="animate-in space-y-8 duration-500 fade-in">
        <div className="group relative space-y-6 overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-inner sm:p-8">
          <div className="pointer-events-none absolute top-0 right-0 h-32 w-32 bg-[#fdcc4b]/5 blur-3xl transition-colors group-hover:bg-[#fdcc4b]/10" />

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
            className="flex h-16 w-full items-center justify-center rounded-2xl border-2 border-red-500/30 font-black text-xs tracking-widest text-red-500 uppercase transition-all hover:-translate-y-0.5 hover:bg-red-500 hover:text-white active:scale-95 disabled:opacity-50"
          >
            {isCancelling ? <Loader2 className="h-5 w-5 animate-spin" /> : "Cancel Booking"}
          </button>
        )}

        <div className="text-center">
          <p className="font-black text-[9px] tracking-[0.4em] text-stone-600 uppercase opacity-40">
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
      <div className="mr-4 shrink-0 rounded-2xl border border-[#fdcc4b]/20 bg-[#26300D] p-3 text-[#fdcc4b] shadow-lg">
        {React.isValidElement(icon)
          ? React.cloneElement(icon as React.ReactElement<{ className?: string }>, {
              className: "w-5 h-5",
            })
          : icon}
      </div>
      <div className="min-w-0 pt-1 text-left">
        <p className="mb-0.5 font-black text-[10px] leading-none tracking-[0.15em] text-[#fdcc4b]/50 uppercase">{label}</p>
        <p className="font-black text-lg leading-tight tracking-tight wrap-break-word whitespace-pre-wrap text-white sm:text-xl">{value}</p>
      </div>
    </div>
  );
}
