"use client";

import { useState, useTransition } from "react";
import { updateBookingStatusAction } from "./actions";
import { cn } from "@/lib/utils";
import { Check, X, Clock, Loader2, Copy } from "lucide-react";

export function BookingStatusButtons({ bookingId, currentStatus }: { bookingId: number; currentStatus: string | null }) {
  const [isPending, startTransition] = useTransition();

  const update = (status: string) => {
    startTransition(async () => {
      await updateBookingStatusAction(bookingId, status);
    });
  };

  if (isPending) {
    return <Loader2 className="w-3.5 h-3.5 animate-spin text-[#5F624F]" />;
  }

  return (
    <div className="flex items-center gap-1">
      {currentStatus !== "confirmed" && (
        <button
          type="button"
          title="Confirm"
          onClick={() => update("confirmed")}
          className="p-1 rounded-md hover:bg-green-50 text-green-600 transition-colors"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
      )}
      {currentStatus !== "waitlisted" && currentStatus !== "cancelled" && (
        <button
          type="button"
          title="Waitlist"
          onClick={() => update("waitlisted")}
          className="p-1 rounded-md hover:bg-amber-50 text-amber-600 transition-colors"
        >
          <Clock className="w-3.5 h-3.5" />
        </button>
      )}
      {currentStatus !== "cancelled" && (
        <button
          type="button"
          title="Cancel"
          onClick={() => update("cancelled")}
          className="p-1 rounded-md hover:bg-red-50 text-red-500 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export function CopyLinkButton({ eventId }: { eventId: number }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      title="Copy booking link"
      onClick={() => {
        const url = `${window.location.origin}/book/event/${eventId}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-colors",
        copied ? "bg-green-100 text-green-700 border border-green-200" : "bg-[#F7F4EA] text-[#5F624F] border border-[#E6DFC8] hover:bg-[#E6DFC8]"
      )}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied!" : "Copy Booking Link"}
    </button>
  );
}
