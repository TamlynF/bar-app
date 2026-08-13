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
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex h-11 items-center gap-2 rounded-xl border border-admin-primary px-4 text-[13px] font-semibold text-admin-primary transition-colors hover:bg-admin-primary-soft"
      >
        <Printer className="h-4 w-4" />
        Print
      </button>
    </div>
  );
}
