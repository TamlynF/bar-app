"use client";

import React, { useState, useTransition } from "react";
import { updatePrivateHireStatus } from "../actions";
import { ChevronRight, CheckCircle, XCircle, Clock, Users, Loader2, MessageSquareQuote } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { privateHireSubtypeLabel, unwrapSubtype, type PrivateHireSubtype } from "@/lib/private-hire-subtype";

export interface PrivateHireRequest {
  id: string;
  full_name: string;
  email: string;
  phone_no: string | null;
  guest_count: number;
  preferred_date: string | null;
  preferred_start_time: string | null;
  preferred_end_time: string | null;
  selected_date: string | null;
  selected_start_time: string | null;
  selected_end_time: string | null;
  reason_for_hire: string;
  reason: string | null;
  event_subtypes_id: number | null;
  event_subtypes: Pick<PrivateHireSubtype, "name" | "default_event_title"> | Pick<PrivateHireSubtype, "name" | "default_event_title">[] | null;
  additional_requirements: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

const STATUS_THEME: Record<
  string,
  { bg: string; text: string; border: string; dot: string; icon: React.ReactNode; label: string }
> = {
  pending: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    dot: "bg-amber-500",
    icon: <Clock className="w-5 h-5" />,
    label: "Pending",
  },
  confirmed: {
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
    dot: "bg-green-500",
    icon: <CheckCircle className="w-5 h-5" />,
    label: "Confirmed",
  },
  cancelled: {
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    dot: "bg-red-500",
    icon: <XCircle className="w-5 h-5" />,
    label: "Cancelled",
  },
};

const normStatus = (s?: string) => (s || "").trim().toLowerCase();

function formatTime12(t?: string | null): string {
  if (!t) return "";
  const [hh, mm] = t.split(":");
  const h = parseInt(hh, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${mm} ${ampm}`;
}

const formatDate = (d?: string | null) =>
  d ? format(new Date(d + "T00:00:00"), "EEE, d MMM yyyy") : undefined;

const formatTimeRange = (start?: string | null, end?: string | null) =>
  [formatTime12(start), formatTime12(end)].filter(Boolean).join(" – ");

function SheetRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-[#E6DFC8] last:border-0">
      <span className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] shrink-0 pt-0.5">
        {label}
      </span>
      <span className="text-sm font-bold text-[#1F1F1A] text-right">{value || "—"}</span>
    </div>
  );
}

export function PrivateHireCard({ request }: { request: PrivateHireRequest }) {
  const [open, setOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState(request.admin_notes || "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const status = normStatus(request.status);
  const theme = STATUS_THEME[status] ?? STATUS_THEME.pending;
  const reasonLabel = privateHireSubtypeLabel(unwrapSubtype(request.event_subtypes), request.reason_for_hire);

  function handleAction(newStatus: "confirmed" | "cancelled") {
    setError(null);
    startTransition(async () => {
      try {
        await updatePrivateHireStatus(request.id, newStatus, adminNotes || undefined);
        setOpen(false);
      } catch {
        setError("Failed to update. Please try again.");
      }
    });
  }

  return (
    <>
      {/* Card row */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "w-full bg-white rounded-2xl border-2 border-[#E6DFC8] overflow-hidden",
          "flex items-center gap-3 px-3 py-3.5 text-left",
          "hover:bg-[#F7F4EA]/60 transition-all active:scale-[0.98] shadow-sm"
        )}
      >
        {/* Status badge circle (left) */}
        <div
          className={cn(
            "w-11 h-11 rounded-full flex items-center justify-center shrink-0 border",
            theme.bg,
            theme.text,
            theme.border
          )}
        >
          {theme.icon}
        </div>

        {/* Name + email + guests */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="font-black text-sm text-[#1F1F1A] uppercase tracking-tight truncate">
              {request.full_name}
            </p>
            {request.admin_notes && (
              <span className="shrink-0 text-[10px] font-black text-purple-700 uppercase bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                ADMIN
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[#5F624F]">
            <p className="text-xs truncate font-semibold">{request.email}</p>
            <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold opacity-60">
              <Users className="w-3 h-3" />
              {request.guest_count}
            </span>
          </div>
        </div>

        <ChevronRight className="w-4 h-4 text-[#5F624F]/50 shrink-0" />
      </button>

      {/* Bottom sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="bg-[#F7F4EA] border-t-2 border-[#E6DFC8] rounded-t-[2.5rem] p-0 h-[85vh]
            flex flex-col outline-none shadow-2xl
            sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-140
            sm:h-auto sm:max-h-[80vh] sm:rounded-4xl sm:bottom-6
            sm:border-2 sm:border-[#E6DFC8]"
        >
          {/* Sheet header */}
          <div className="shrink-0 p-4 pb-3 border-b border-[#E6DFC8] bg-white/80 backdrop-blur-md sticky top-0 z-30 sm:rounded-t-4xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <SheetTitle className="text-lg font-black text-[#1F1F1A] uppercase tracking-tight leading-tight truncate">
                  {request.full_name}
                </SheetTitle>
                <p className="text-xs text-[#5F624F] mt-0.5">{request.email}</p>
              </div>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider shrink-0",
                  theme.bg,
                  theme.text,
                  theme.border
                )}
              >
                <span className={cn("w-2 h-2 rounded-full", theme.dot)} />
                {theme.label}
              </span>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-6 min-h-0 touch-pan-y space-y-6">
            {/* Event details + Contact side by side on sm+ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-wide text-[#5F624F]">
                  Event Details
                </p>
                <div className="bg-white border border-[#E6DFC8] rounded-2xl px-4 overflow-hidden">
                  <SheetRow label="Reason for Hire" value={reasonLabel} />
                  <SheetRow label="Guests" value={request.guest_count} />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-wide text-[#5F624F]">
                  Contact
                </p>
                <div className="bg-white border border-[#E6DFC8] rounded-2xl px-4 overflow-hidden">
                  <SheetRow label="Name" value={request.full_name} />
                  <SheetRow label="Email" value={request.email} />
                  <SheetRow label="Phone" value={request.phone_no} />
                </div>
              </div>
            </div>

            {/* Requested vs selected slot side by side on sm+ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-wide text-[#5F624F]">
                  Requested Time
                </p>
                <div className="bg-white border border-[#E6DFC8] rounded-2xl px-4 overflow-hidden">
                  <SheetRow label="Date" value={formatDate(request.preferred_date)} />
                  <SheetRow label="Time" value={formatTimeRange(request.preferred_start_time, request.preferred_end_time)} />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-wide text-[#5F624F]">
                  Selected Time
                </p>
                <div className="bg-white border border-[#E6DFC8] rounded-2xl px-4 overflow-hidden">
                  <SheetRow label="Date" value={formatDate(request.selected_date)} />
                  <SheetRow label="Time" value={formatTimeRange(request.selected_start_time, request.selected_end_time)} />
                </div>
              </div>
            </div>

            {/* Additional requirements */}
            {request.additional_requirements && (
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-wide text-[#5F624F]">
                  Additional Requirements
                </p>
                <p className="text-sm text-[#1F1F1A] bg-white border border-[#E6DFC8] rounded-2xl px-4 py-3">
                  {request.additional_requirements}
                </p>
              </div>
            )}

            {/* Submitted */}
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-wide text-[#5F624F]">
                Submitted
              </p>
              <p className="text-sm text-[#1F1F1A]">
                {new Date(request.created_at).toLocaleDateString("en-GB", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>

            {/* Admin notes (read-only once cancelled; pending & confirmed edit it in the footer) */}
            {status === "cancelled" && request.admin_notes && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] mb-2">
                  Admin Notes
                </p>
                <div className="bg-[#5C4033]/5 p-4 rounded-2xl border border-[#5C4033]/15">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquareQuote className="w-4 h-4 text-[#5C4033] opacity-40" />
                    <span className="text-[10px] font-black uppercase tracking-wide text-[#5C4033]">
                      Staff Note
                    </span>
                  </div>
                  <p className="text-sm text-[#1F1F1A] italic leading-relaxed">
                    &quot;{request.admin_notes}&quot;
                  </p>
                </div>
              </div>
            )}
            <div className="h-4" />
          </div>

          {/* Footer — actions for pending (confirm/cancel) and confirmed (cancel) enquiries */}
          {(status === "pending" || status === "confirmed") && (
            <div className="shrink-0 px-6 py-5 pb-10 sm:pb-5 border-t-2 border-[#E6DFC8] bg-white/80 backdrop-blur-md z-40 sm:rounded-b-4xl">
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wide text-[#5F624F] mb-1.5">
                    Note to Enquirer (optional)
                  </label>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Add a message to include in the outcome email..."
                    rows={2}
                    className="w-full bg-[#F7F4EA] border border-[#E6DFC8] rounded-2xl px-4 py-3 text-sm text-[#1F1F1A] placeholder:text-[#5F624F]/50 focus:outline-none focus:border-[#5C4033]/30 resize-none transition-all"
                  />
                </div>

                {error && <p className="text-red-500 text-xs font-bold">{error}</p>}

                {status === "pending" ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleAction("confirmed")}
                      disabled={isPending}
                      className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl py-3 transition-all disabled:opacity-50"
                    >
                      {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAction("cancelled")}
                      disabled={isPending}
                      className="flex-1 flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-black text-xs uppercase tracking-wider rounded-2xl py-3 transition-all disabled:opacity-50"
                    >
                      {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleAction("cancelled")}
                    disabled={isPending}
                    className="w-full flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-black text-xs uppercase tracking-wider rounded-2xl py-3 transition-all disabled:opacity-50"
                  >
                    {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                    Cancel Booking
                  </button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
