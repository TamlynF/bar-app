"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { retryBookingPayment } from "@/app/(public)/_actions/retry-payment";

export default function RetryPaymentButton({
  bookingId,
  amount,
}: {
  bookingId: string | number;
  amount: number | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const handleRetry = () => {
    setError("");
    startTransition(async () => {
      const result = await retryBookingPayment(bookingId);
      if ("checkoutUrl" in result) {
        window.location.href = result.checkoutUrl;
      } else if ("alreadyPaid" in result) {
        window.location.reload();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={handleRetry}
        disabled={isPending || !!error}
        className="flex h-14 w-full items-center justify-center rounded-2xl bg-[#26300D] font-black text-[11px] tracking-widest text-[#FDCC4B] uppercase shadow-lg transition-all hover:bg-[#1e260a] active:scale-95 disabled:opacity-50"
      >
        {isPending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : amount != null ? (
          `Confirm & Pay £${amount.toFixed(2)}`
        ) : (
          "Confirm & Pay"
        )}
      </button>
      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border-2 border-red-200 bg-red-50 p-4 text-left">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <p className="text-xs leading-snug font-bold text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
}
