"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";

export default function PrintActions({ eventId }: { eventId: number }) {
  return (
    <div data-print-hide className="mb-5 flex items-center justify-between gap-3">
      <Link
        href={`/event-setups/events/${eventId}`}
        className="inline-flex h-11 items-center gap-2 rounded-xl border border-admin-line px-4 text-[13px] font-semibold text-admin-muted transition-colors hover:bg-admin-surface hover:text-admin-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to quiz
      </Link>
      {/* window.print() does not return until the print dialog is closed, so
          calling it straight from the handler freezes the click mid-interaction -
          the button never paints its pressed state, and however long the dialog
          stays open is charged to the click as INP.

          A bare setTimeout is not enough: a 0ms task can still run before the
          browser renders. requestAnimationFrame fires just before the next paint
          and the timeout inside it lands just after, so the interaction is
          finished and painted by the time the dialog blocks anything. */}
      <button
        type="button"
        onClick={() =>
          requestAnimationFrame(() => setTimeout(() => window.print(), 0))
        }
        className="inline-flex h-11 items-center gap-2 rounded-xl border border-admin-primary px-4 text-[13px] font-semibold text-admin-primary transition-colors hover:bg-admin-primary-soft"
      >
        <Printer className="h-4 w-4" />
        Print
      </button>
    </div>
  );
}
