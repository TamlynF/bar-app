"use client";

import React, { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  CalendarDays,
  Users,
  User,
  Ticket,
  CreditCard,
  CheckCircle,
  XCircle,
  ChevronDown,
  Clock3,
  Loader2,
  Save,
  AlertCircle,
  MessageSquareQuote,
  X,
} from "lucide-react";
import { cancelBooking } from "@/app/(public)/_actions/cancel-booking";
import { checkSeatingAvailability } from "@/app/(public)/_actions/check-seating";
import { updateBooking } from "@/app/(public)/_actions/update-booking";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import type { GroupSizeFieldConfig } from "@/lib/booking-config";

export interface ManageEventBooking {
  id: string | number;
  event_id: number | null;
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
    seating_required: boolean | null;
  } | null;
  contacts: {
    full_name: string | null;
    email: string | null;
  } | null;
}

const NO_SEATING_SPACE_ERROR = "Not enough space for this party size at this event.";

const inputBaseClasses =
  "w-full bg-black/40 border border-white/10 rounded-2xl pl-11 pr-10 py-4 text-white placeholder-stone-700 focus:outline-none focus:border-[#fdcc4b] focus:ring-1 focus:ring-[#fdcc4b] transition-all duration-300 text-sm font-bold appearance-none";
const labelClasses =
  "block text-[10px] font-black text-[#fdcc4b]/70 mb-2 uppercase tracking-[0.15em] ml-1";
const iconContainerClasses = "absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none";
const iconClasses = "w-4 h-4 text-[#fdcc4b]/40";

export default function ManageBookingView({
  booking,
  isCancelled: initialCancelled,
  groupSizeField,
}: {
  booking: ManageEventBooking;
  isCancelled: boolean;
  groupSizeField: GroupSizeFieldConfig;
}) {
  const { confirm, ConfirmDialogUI } = useConfirm();
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState("");
  const [isCancelled, setIsCancelled] = useState(initialCancelled);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [groupSize, setGroupSize] = useState(String(booking.group_size ?? ""));
  const [specialRequests, setSpecialRequests] = useState(booking.special_requests ?? "");
  const [isCheckingSeating, setIsCheckingSeating] = useState(false);
  const [seatingError, setSeatingError] = useState("");

  const eventDateStr = booking.events?.event_date;
  const eventDate = eventDateStr ? new Date(eventDateStr + "T00:00:00") : null;
  const status = (booking.status || "").toLowerCase();
  const isPending = !isCancelled && status === "pending";
  const isUnpaid = booking.payment_status === "unpaid";

  const seatingRequired = booking.events?.seating_required === true;
  const eventId = booking.event_id;
  const bookingId = booking.id;

  const sizeOptions = useMemo(() => {
    const sizes = new Set<number>();
    for (let n = groupSizeField.min; n <= groupSizeField.max; n++) sizes.add(n);
    if (booking.group_size) sizes.add(booking.group_size);
    return Array.from(sizes).sort((a, b) => a - b);
  }, [groupSizeField.min, groupSizeField.max, booking.group_size]);

  useEffect(() => {
    const validateSeating = async () => {
      const size = parseInt(groupSize, 10);
      if (!isEditing || !seatingRequired || !eventId || !size || size < 1) {
        setSeatingError("");
        setIsCheckingSeating(false);
        return;
      }

      setIsCheckingSeating(true);
      try {
        const { hasSpace } = await checkSeatingAvailability(eventId, size, bookingId);
        setSeatingError(hasSpace ? "" : NO_SEATING_SPACE_ERROR);
      } catch (err) {
        console.error("Seating validation error:", err);
      } finally {
        setIsCheckingSeating(false);
      }
    };

    const timer = setTimeout(validateSeating, 400);
    return () => clearTimeout(timer);
  }, [groupSize, isEditing, seatingRequired, eventId, bookingId]);

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

  const handleSave = async () => {
    if (seatingError) return;

    setIsSaving(true);
    setError("");
    setSuccessMsg("");

    const response = await updateBooking(booking.id, {
      group_size: parseInt(groupSize, 10),
      special_requests: specialRequests,
    });

    if (response.success) {
      setSuccessMsg("Changes saved successfully.");
      setIsEditing(false);
    } else {
      setError(response.error || "Failed to update booking.");
    }
    setIsSaving(false);
  };

  const discardChanges = () => {
    setIsEditing(false);
    setGroupSize(String(booking.group_size ?? ""));
    setSpecialRequests(booking.special_requests ?? "");
    setSeatingError("");
    setError("");
  };

  const canModify = !isCancelled && !(isPending && isUnpaid);

  const saveDisabled =
    isSaving ||
    isCheckingSeating ||
    !!seatingError ||
    !!error ||
    !parseInt(groupSize, 10);

  return (
    <div className="w-full">
      <div className="mb-8 animate-in text-center duration-500 fade-in">
        {isEditing ? (
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#fdcc4b]/20 bg-[#fdcc4b]/10 px-3 py-1">
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#fdcc4b]" />
            <span className="font-black text-[10px] tracking-widest text-[#fdcc4b] uppercase">Editing Mode</span>
          </div>
        ) : isCancelled ? (
          <XCircle className="mx-auto mb-4 h-16 w-16 text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.3)]" />
        ) : isPending ? (
          <Clock3 className="mx-auto mb-4 h-16 w-16 text-amber-400 drop-shadow-[0_0_15px_rgba(251,191,36,0.3)]" />
        ) : (
          <CheckCircle className="mx-auto mb-4 h-16 w-16 text-[#fdcc4b] drop-shadow-[0_0_15px_rgba(253,204,75,0.3)]" />
        )}

        <h1 className="font-black text-2xl leading-none tracking-tighter text-white uppercase sm:text-4xl">
          {isEditing ? "Modify Booking" : isCancelled ? "Booking Cancelled" : "Your Booking"}
        </h1>
        {!isEditing && (
          <p className="mt-2 text-xs font-bold tracking-widest text-stone-500 uppercase sm:text-sm">
            Ref: #{booking.id}
          </p>
        )}
      </div>

      {error && (
        <div className="mb-6 flex animate-in items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 slide-in-from-top-2">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
          <p className="flex-1 text-xs leading-snug font-bold tracking-tight text-red-400 uppercase">{error}</p>
          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Dismiss error"
            className="-m-3 flex h-11 w-11 shrink-0 items-center justify-center text-red-400/70 transition-colors hover:text-red-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {successMsg && !isEditing && (
        <div className="mb-6 flex animate-in items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 fade-in">
          <CheckCircle className="h-4 w-4 text-emerald-400" />
          <p className="font-black text-xs tracking-widest text-emerald-400 uppercase">{successMsg}</p>
        </div>
      )}

      {isPending && isUnpaid && !isEditing && (
        <div className="mb-6 flex animate-in items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 slide-in-from-top-2">
          <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <p className="text-xs leading-snug font-bold tracking-tight text-amber-400 uppercase">
            Payment not yet completed. If you didn&apos;t finish checkout, please rebook or contact the bar.
          </p>
        </div>
      )}

      {isEditing ? (
        <div className="animate-in space-y-6 duration-300 fade-in slide-in-from-bottom-4">
          <div className="space-y-1.5">
            <label htmlFor="groupSize" className={labelClasses}>
              {groupSizeField.label} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className={iconContainerClasses}>
                <Users className={iconClasses} />
              </div>
              <select
                id="groupSize"
                value={groupSize}
                onChange={(e) => {
                  setError("");
                  setGroupSize(e.target.value);
                }}
                className={cn(inputBaseClasses, "cursor-pointer", seatingError && "border-red-500/50")}
              >
                {sizeOptions.map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "person" : "people"}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-[#fdcc4b]/40">
                {isCheckingSeating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
              </div>
            </div>
            {seatingError && (
              <p className="mt-1.5 ml-1 font-black text-[9px] text-red-500 uppercase">{seatingError}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="specialRequests" className={labelClasses}>
              Special Requests
            </label>
            <div className="relative">
              <div className={iconContainerClasses}>
                <MessageSquareQuote className={iconClasses} />
              </div>
              <textarea
                id="specialRequests"
                value={specialRequests}
                onChange={(e) => {
                  setError("");
                  setSpecialRequests(e.target.value);
                }}
                className={cn(inputBaseClasses, "min-h-25 resize-none py-3")}
                placeholder="Dietary requirements, table preference..."
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saveDisabled}
              className="flex h-16 w-full items-center justify-center rounded-2xl bg-[#fdcc4b] font-black text-lg tracking-widest text-[#26300D] uppercase shadow-[0_15px_30px_-5px_rgba(253,204,75,0.3)] transition-all hover:bg-[#e5b843] active:scale-95 disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <Save className="mr-2 h-6 w-6" /> Save Changes
                </>
              )}
            </button>
            <button
              type="button"
              onClick={discardChanges}
              disabled={isSaving}
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
            <div className={cn("grid grid-cols-1 gap-3", canModify && "sm:grid-cols-2")}>
              {canModify && (
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setSuccessMsg("");
                    setIsEditing(true);
                  }}
                  disabled={isCancelling}
                  className="flex h-16 w-full items-center justify-center rounded-2xl bg-[#fdcc4b] font-black text-sm tracking-widest text-[#26300D] uppercase shadow-lg transition-all hover:-translate-y-0.5 hover:bg-[#e5b843] active:scale-95 disabled:opacity-50"
                >
                  Modify Booking
                </button>
              )}

              <button
                type="button"
                onClick={handleCancel}
                disabled={isCancelling}
                className="flex h-16 w-full items-center justify-center rounded-2xl border-2 border-red-500/30 font-black text-xs tracking-widest text-red-500 uppercase transition-all hover:-translate-y-0.5 hover:bg-red-500 hover:text-white active:scale-95 disabled:opacity-50"
              >
                {isCancelling ? <Loader2 className="h-5 w-5 animate-spin" /> : "Cancel Booking"}
              </button>
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
