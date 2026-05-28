"use client";

import React, { useState, useTransition } from "react";
import { updateBandStatus, updateBandBookingFields } from "../actions";
import type { BandStatus } from "../actions";
import {
  ChevronRight,
  Instagram,
  Facebook,
  Youtube,
  Music2,
  Link2,
  CheckCircle2,
  XCircle,
  Clock3,
  HelpCircle,
  Loader2,
  Play,
  X,
  Save,
  CreditCard,
  ExternalLink,
  MessageSquareQuote,
  AlertCircle,
  CalendarDays,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import Link from "next/link";
import { toast } from "sonner";

interface SocialLinks {
  instagram?: string;
  facebook?: string;
  youtube?: string;
  tiktok?: string;
}

export interface BandRequest {
  id: string;
  group_name: string | null;
  type: string | null;
  genre: string | null;
  booker_name: string;
  email: string;
  phone_no: string | null;
  social_links: SocialLinks | null;
  video_urls: string[] | null;
  preferred_dates: string[] | null;
  notes: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  payment_amount: number | null;
  paid_amount: number | null;
  payment_status: string | null;
  selected_date: string | null;
  selected_start_time: string | null;
  selected_end_time: string | null;
  bank_account_no: string | null;
  bank_account_name: string | null;
  bank_sort_code: string | null;
  bank_payment_ref: string | null;
  is_favorite: boolean;
  event_id: number | null;
}

export const statusTheme: Record<
  string,
  {
    bg: string;
    text: string;
    border: string;
    dot: string;
    ring: string;
    cardBorder: string;
    icon: React.ReactNode;
    label: string;
  }
> = {
  all: {
    bg: "bg-[#F7F4EA]",
    text: "text-[#1F1F1A]",
    border: "border-[#E6DFC8]",
    dot: "bg-[#5F624F]",
    ring: "ring-slate-500/40",
    cardBorder: "border-[#E6DFC8]",
    icon: <Music2 className="w-5 h-5" />,
    label: "All",
  },
  confirmed: {
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
    dot: "bg-green-500",
    ring: "ring-green-500/40",
    cardBorder: "border-green-500/50",
    icon: <CheckCircle2 className="w-5 h-5" />,
    label: "Confirmed",
  },
  pending: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    dot: "bg-amber-500",
    ring: "ring-amber-500/40",
    cardBorder: "border-amber-500/50",
    icon: <Clock3 className="w-5 h-5" />,
    label: "Pending",
  },
  waitlisted: {
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200",
    dot: "bg-orange-500",
    ring: "ring-orange-500/40",
    cardBorder: "border-orange-500/50",
    icon: <HelpCircle className="w-5 h-5" />,
    label: "Waitlisted",
  },
  cancelled: {
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    dot: "bg-red-500",
    ring: "ring-red-500/40",
    cardBorder: "border-red-500/50",
    icon: <XCircle className="w-5 h-5" />,
    label: "Cancelled",
  },
};

const SOCIAL_ICONS: Record<string, React.ElementType> = {
  instagram: Instagram,
  facebook: Facebook,
  youtube: Youtube,
  tiktok: Music2,
};

const normStatus = (s?: string) => (s || "").trim().toLowerCase();

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

function toTitleCase(str?: string | null) {
  if (!str) return "";
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

function formatTime12(t?: string | null): string {
  if (!t) return "";
  const [hh, mm] = t.split(":");
  const h = parseInt(hh, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${mm} ${ampm}`;
}

export function BandBookingCard({ request }: { request: BandRequest }) {
  const [open, setOpen] = useState(false);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState(request.admin_notes || "");
  const [selectedDate, setSelectedDate] = useState(request.selected_date || "");
  const [selectedStartTime, setSelectedStartTime] = useState(request.selected_start_time || "");
  const [selectedEndTime, setSelectedEndTime] = useState(request.selected_end_time || "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const status = normStatus(request.status);
  const theme = statusTheme[status] || statusTheme.pending;

  const socials = request.social_links
    ? Object.entries(request.social_links).filter(([, v]) => v)
    : [];
  const videos = (request.video_urls ?? []).filter(Boolean);
  const dates = (request.preferred_dates ?? []).filter(Boolean);

  const needsPayment =
    (request.payment_amount ?? 0) > 0 && request.payment_status === "unpaid";

  function handleAction(newStatus: BandStatus) {
    setError(null);
    startTransition(async () => {
      try {
        // Save date/time fields first if they changed
        if (
          selectedDate !== (request.selected_date || "") ||
          selectedStartTime !== (request.selected_start_time || "") ||
          selectedEndTime !== (request.selected_end_time || "")
        ) {
          await updateBandBookingFields(request.id, {
            selected_date: selectedDate || null,
            selected_start_time: selectedStartTime || null,
            selected_end_time: selectedEndTime || null,
          });
        }
        await updateBandStatus(request.id, newStatus, adminNotes || undefined);
        setOpen(false);
      } catch {
        setError("Failed to update. Please try again.");
      }
    });
  }

  function handleSaveFields() {
    setError(null);
    startTransition(async () => {
      try {
        await updateBandBookingFields(request.id, {
          selected_date: selectedDate || null,
          selected_start_time: selectedStartTime || null,
          selected_end_time: selectedEndTime || null,
          admin_notes: adminNotes || null,
        });
        toast.success("Changes saved");
      } catch {
        setError("Failed to save. Please try again.");
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
            "w-11 h-11 rounded-full flex flex-col items-center justify-center shrink-0 border",
            theme.bg,
            theme.text,
            theme.border
          )}
        >
          {status === "confirmed" && request.selected_date ? (
            <div className="flex flex-col leading-none items-center justify-center">
              <span className="text-[10px] font-black uppercase tracking-tighter opacity-80 mb-0.5">
                {format(new Date(request.selected_date + "T00:00:00"), "MMM")}
              </span>
              <span className="text-base font-black tracking-tighter">
                {format(new Date(request.selected_date + "T00:00:00"), "dd")}
              </span>
            </div>
          ) : (
            theme.icon
          )}
        </div>

        {/* Names + type/genre */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="font-black text-sm text-[#1F1F1A] uppercase tracking-tight truncate">
              {request.group_name || request.booker_name}
            </p>
            {/* Indicators */}
            {request.notes && (
              <span className="shrink-0 text-[10px] font-black text-blue-700 uppercase bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                NOTE
              </span>
            )}
            {request.admin_notes && (
              <span className="shrink-0 text-[10px] font-black text-purple-700 uppercase bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                ADMIN
              </span>
            )}
            {needsPayment && (
              <span className="shrink-0 text-[10px] font-black text-amber-700 uppercase bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                PAY
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[#5F624F]">
            <p className="text-xs truncate font-semibold">{request.booker_name}</p>
            {(request.type || request.genre) && (
              <span className="text-[10px] font-bold opacity-60 truncate">
                {[toTitleCase(request.type), toTitleCase(request.genre)].filter(Boolean).join(" / ")}
              </span>
            )}
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
            sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[560px]
            sm:h-auto sm:max-h-[80vh] sm:rounded-[2rem] sm:bottom-6
            sm:border-2 sm:border-[#E6DFC8]"
        >
          {/* Sheet header */}
          <div className="shrink-0 p-4 pb-3 border-b border-[#E6DFC8] bg-white/80 backdrop-blur-md sticky top-0 z-30 sm:rounded-t-[2rem]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <SheetTitle className="text-lg font-black text-[#1F1F1A] uppercase tracking-tight leading-tight truncate">
                  {request.group_name || request.booker_name}
                </SheetTitle>
                {request.group_name && (
                  <p className="text-xs text-[#5F624F] mt-0.5">{request.booker_name}</p>
                )}
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
          <div className="flex-1 overflow-y-auto px-6 py-6 min-h-0 touch-pan-y space-y-5">
            <div className="space-y-6">
              {/* Event details + Contact side by side on sm+ */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Event details */}
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-wide text-[#5F624F]">
                    Event Details
                  </p>
                  <div className="bg-white border border-[#E6DFC8] rounded-2xl px-4 overflow-hidden">
                    <SheetRow label="Act Name" value={request.group_name} />
                    <SheetRow label="Type" value={toTitleCase(request.type)} />
                    <SheetRow label="Genre" value={toTitleCase(request.genre)} />

                    {/* Selected date/time */}
                    {selectedDate && (
                      <SheetRow
                        label="Selected Date"
                        value={format(new Date(selectedDate + "T00:00:00"), "EEE, d MMM yyyy")}
                      />
                    )}
                    {(selectedStartTime || selectedEndTime) && (
                      <SheetRow
                        label="Time"
                        value={
                          [formatTime12(selectedStartTime), formatTime12(selectedEndTime)]
                            .filter(Boolean)
                            .join(" – ") || "—"
                        }
                      />
                    )}

                    {/* Preferred dates with selection */}
                    {dates.length > 0 && (
                      <div className="py-3 border-b border-[#E6DFC8] last:border-0">
                        <span className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] block mb-2">
                          Preferred Dates
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {dates.map((d, i) => {
                            const isSelected = selectedDate === d;
                            return (
                              <button
                                key={i}
                                type="button"
                                onClick={() => {
                                  setSelectedDate(isSelected ? "" : d);
                                }}
                                className={cn(
                                  "px-3 py-1.5 rounded-xl text-xs font-bold border transition-all",
                                  isSelected
                                    ? "bg-[#5C4033] text-white border-[#5C4033]"
                                    : "bg-white border-[#E6DFC8] text-[#1F1F1A] hover:border-[#5C4033]/30"
                                )}
                              >
                                {format(new Date(d + "T00:00:00"), "EEE, d MMM")}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Time inputs when a date is selected */}
                    {selectedDate && (
                      <div className="py-3 border-b border-[#E6DFC8] last:border-0">
                        <span className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] block mb-2">
                          Performance Time
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] font-bold text-[#5F624F] uppercase block mb-1">Start</label>
                            <input
                              type="time"
                              value={selectedStartTime}
                              onChange={(e) => setSelectedStartTime(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl border border-[#E6DFC8] bg-[#F7F4EA] text-sm font-bold text-[#1F1F1A] focus:outline-none focus:border-[#5C4033]/30"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-[#5F624F] uppercase block mb-1">End</label>
                            <input
                              type="time"
                              value={selectedEndTime}
                              onChange={(e) => setSelectedEndTime(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl border border-[#E6DFC8] bg-[#F7F4EA] text-sm font-bold text-[#1F1F1A] focus:outline-none focus:border-[#5C4033]/30"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Notes from applicant */}
                    {request.notes && (
                      <div className="py-3 border-b border-[#E6DFC8] last:border-0">
                        <span className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] block mb-1.5">
                          Notes from Applicant
                        </span>
                        <p className="text-sm text-[#1F1F1A] leading-relaxed italic">
                          &quot;{request.notes}&quot;
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Contact info */}
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-wide text-[#5F624F]">
                    Contact Information
                  </p>
                  <div className="bg-white border border-[#E6DFC8] rounded-2xl px-4 overflow-hidden">
                    <SheetRow label="Name" value={request.booker_name} />
                    <SheetRow label="Email" value={request.email} />
                    <SheetRow label="Phone" value={request.phone_no} />
                    <SheetRow
                      label="Submitted"
                      value={new Date(request.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    />
                  </div>
                </div>
              </div>

              {/* Payment Details section */}
              {(request.payment_amount ?? 0) > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-wide text-[#5F624F]">
                    Payment Details
                  </p>
                  <div className="bg-white border border-[#E6DFC8] rounded-2xl px-4 overflow-hidden">
                    <SheetRow
                      label="Amount"
                      value={
                        <span className="flex items-center gap-1.5">
                          <CreditCard className="w-3.5 h-3.5 text-[#5F624F] opacity-50" />
                          £{(request.payment_amount ?? 0).toFixed(2)}
                        </span>
                      }
                    />
                    <SheetRow
                      label="Paid"
                      value={`£${(request.paid_amount ?? 0).toFixed(2)}`}
                    />
                    <SheetRow
                      label="Status"
                      value={
                        <span
                          className={cn(
                            "text-[10px] font-black uppercase tracking-tight px-2 py-1 rounded-lg border",
                            request.payment_status === "paid"
                              ? "bg-green-50 border-green-200 text-green-700"
                              : "bg-amber-50 border-amber-200 text-amber-700"
                          )}
                        >
                          {request.payment_status || "unpaid"}
                        </span>
                      }
                    />
                    {request.bank_account_name && (
                      <SheetRow label="Account Name" value={request.bank_account_name} />
                    )}
                    {request.bank_account_no && (
                      <SheetRow label="Account No." value={request.bank_account_no} />
                    )}
                    {request.bank_sort_code && (
                      <SheetRow label="Sort Code" value={request.bank_sort_code} />
                    )}
                    {request.bank_payment_ref && (
                      <SheetRow label="Payment Ref" value={request.bank_payment_ref} />
                    )}
                  </div>
                </div>
              )}

              {/* Linked Event navigation */}
              {request.event_id && (
                <Link
                  href={`/event-setups/events/${request.event_id}`}
                  className="flex items-center justify-between gap-3 bg-white border border-[#E6DFC8] rounded-2xl px-4 py-3.5 hover:bg-[#F7F4EA] transition-colors group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CalendarDays className="w-4 h-4 text-[#5C4033] shrink-0" />
                    <span className="text-xs font-black uppercase tracking-wide text-[#5C4033]">
                      View Linked Event
                    </span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-[#5F624F] group-hover:text-[#5C4033] transition-colors shrink-0" />
                </Link>
              )}

              {/* Social links */}
              {socials.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] mb-2">
                    Social Media
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {socials.map(([key, url]) => {
                      const Icon = SOCIAL_ICONS[key] ?? Link2;
                      return (
                        <a
                          key={key}
                          href={url as string}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#E6DFC8] rounded-xl text-xs font-bold text-[#5C4033] hover:bg-[#F7F4EA] transition-colors"
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {key.charAt(0).toUpperCase() + key.slice(1)}
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Videos */}
              {videos.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] mb-2">
                    Performance Videos
                  </p>
                  <div className="flex flex-row flex-wrap gap-1.5">
                    {videos.map((url, i) => {
                      const isStorage =
                        url.includes("supabase.co/storage") || url.includes(".supabase.co");
                      return isStorage ? (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setActiveVideo(url)}
                          className="relative h-16 w-24 shrink-0 rounded-xl overflow-hidden bg-[#5C4033] flex flex-col items-center justify-center gap-1 group active:scale-95 transition-transform"
                        >
                          <div className="w-8 h-8 rounded-full bg-[#5C4033]/15 border border-[#C8956D]/40 flex items-center justify-center group-hover:bg-[#C8956D]/30 transition-colors">
                            <Play className="w-3.5 h-3.5 text-white fill-white translate-x-px" />
                          </div>
                          <span className="text-[9px] font-black text-white/70 uppercase tracking-wide">
                            Video {i + 1}
                          </span>
                        </button>
                      ) : (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-16 w-24 shrink-0 rounded-xl flex flex-col items-center justify-center gap-1 bg-white border border-[#E6DFC8] text-[#5F624F] hover:bg-[#F7F4EA] transition-colors"
                        >
                          <Link2 className="w-4 h-4" />
                          <span className="text-[9px] font-black uppercase tracking-wide">
                            Link {i + 1}
                          </span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Admin notes (read-only if resolved, editable if pending) */}
              {status !== "pending" && request.admin_notes && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] mb-2">
                    Admin Notes
                  </p>
                  <div className="bg-[#5C4033]/5 p-4 rounded-2xl border border-[#5C4033]/15">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquareQuote className="w-4 h-4 text-[#5C4033] opacity-40" />
                      <span className="text-[10px] font-black uppercase tracking-wide text-[#5C4033]">Staff Note</span>
                    </div>
                    <p className="text-sm text-[#1F1F1A] italic leading-relaxed">
                      &quot;{request.admin_notes}&quot;
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className="h-32" />
          </div>

          {/* Footer */}
          <div className="shrink-0 px-6 py-5 pb-10 sm:pb-5 border-t-2 border-[#E6DFC8] bg-white/80 backdrop-blur-md z-40 sm:rounded-b-[2rem]">
            {/* Action area — pending only */}
            {status === "pending" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wide text-[#5F624F] mb-1.5">
                    Note to Applicant (optional)
                  </label>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Add a message to include in the outcome email..."
                    rows={2}
                    className="w-full bg-[#F7F4EA] border border-[#E6DFC8] rounded-2xl px-4 py-3 text-sm text-[#1F1F1A] placeholder:text-[#5F624F]/50 focus:outline-none focus:border-[#5C4033]/30 resize-none transition-all"
                  />
                </div>

                {!selectedDate && dates.length > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <p className="text-[10px] font-black uppercase text-amber-700 tracking-tight">
                      Select a preferred date above before confirming
                    </p>
                  </div>
                )}

                {error && <p className="text-red-500 text-xs font-bold">{error}</p>}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleAction("confirmed")}
                    disabled={isPending || !selectedDate}
                    className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl py-3 transition-all disabled:opacity-50"
                  >
                    {isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAction("waitlisted")}
                    disabled={isPending}
                    className="flex-1 flex items-center justify-center gap-2 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 font-black text-xs uppercase tracking-wider rounded-2xl py-3 transition-all disabled:opacity-50"
                  >
                    {isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <HelpCircle className="w-3.5 h-3.5" />
                    )}
                    Waitlist
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAction("cancelled")}
                    disabled={isPending}
                    className="flex-1 flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-black text-xs uppercase tracking-wider rounded-2xl py-3 transition-all disabled:opacity-50"
                  >
                    {isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5" />
                    )}
                    Reject
                  </button>
                </div>
              </div>
            )}

            {/* Save button for non-pending (confirmed/waitlisted) — to update dates/notes */}
            {(status === "confirmed" || status === "waitlisted") && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveFields}
                  disabled={isPending}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#5C4033] hover:bg-[#4a3529] text-white font-black text-xs uppercase tracking-wider rounded-2xl py-3 transition-all disabled:opacity-50"
                >
                  {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Changes
                </button>
                {status === "confirmed" && (
                  <button
                    type="button"
                    onClick={() => handleAction("cancelled")}
                    disabled={isPending}
                    className="flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-black text-xs uppercase tracking-wider rounded-2xl py-3 px-5 transition-all disabled:opacity-50"
                  >
                    {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                    Cancel
                  </button>
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Video modal */}
      <Dialog open={!!activeVideo} onOpenChange={(v) => !v && setActiveVideo(null)}>
        <DialogContent className="bg-black border-0 p-0 max-w-2xl w-full rounded-2xl overflow-hidden">
          <button
            title="Close"
            type="button"
            onClick={() => setActiveVideo(null)}
            className="absolute top-3 right-3 z-50 w-8 h-8 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          {activeVideo && (
            <video
              key={activeVideo}
              src={activeVideo}
              autoPlay
              controls
              className="w-full max-h-[80vh] object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
