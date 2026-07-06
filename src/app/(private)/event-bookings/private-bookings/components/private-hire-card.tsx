"use client";

import React, { useState, useTransition, useEffect } from "react";
import { updatePrivateHireStatus, updatePrivateHireFields, getPrivateEventOptions } from "../actions";
import { ChevronRight, ChevronDown, CheckCircle, XCircle, Clock, Users, Loader2, MessageSquareQuote, Mail, Phone, CalendarDays, Save } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { toHHMM } from "@/lib/event-clash";
import { privateHireSubtypeLabel, unwrapSubtype, type PrivateHireSubtype } from "@/lib/private-hire-subtype";

type PrivateEventOptions = { types: { id: number; name: string }[]; subtypes: { id: number; name: string; event_types_id: number }[] };

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
  event_subtypes: PrivateHireSubtypeJoin | PrivateHireSubtypeJoin[] | null;
  additional_requirements: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string | null;
  updated_by: number | null;
  /** Joined employee for `updated_by` — who last modified the enquiry. */
  updated_by_employee?: { full_name: string | null } | null;
}

/** The event_subtypes join carried on a private-hire request. */
type PrivateHireSubtypeJoin = Pick<PrivateHireSubtype, "id" | "name" | "default_event_title"> & { event_types_id: number };

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
    <div className="flex items-start justify-between gap-4 px-4 sm:px-5 py-3 border-b border-[#E6DFC8] last:border-0">
      <span className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] shrink-0 pt-0.5">
        {label}
      </span>
      <span className="text-sm font-bold text-[#1F1F1A] text-right">{value || "—"}</span>
    </div>
  );
}

function toTitleCase(s?: string | null): string {
  if (!s) return "";
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

/** Full date + time, e.g. "8 May 2026, 14:32" — used in the system information. */
function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

/** A label + value row that becomes an input/select when `editable`. */
function EditRow({
  label, value, onChange, editable, type = "text", placeholder, options, readOnlyValue,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  editable: boolean;
  type?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  readOnlyValue?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-[#E6DFC8] last:border-0">
      <span className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] shrink-0">{label}</span>
      {!editable ? (
        <span className="flex-1 min-w-0 text-sm font-bold text-[#1F1F1A] text-right truncate">{readOnlyValue ?? (value || "—")}</span>
      ) : options ? (
        <select
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-transparent outline-none text-sm font-bold text-[#1F1F1A] text-right [text-align-last:right] cursor-pointer"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : (
        <input
          aria-label={label}
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 min-w-0 bg-transparent outline-none text-sm font-bold text-[#1F1F1A] text-right placeholder:text-[#5F624F]/40"
        />
      )}
    </div>
  );
}

/** A "Requested Time" row that, when applicable, copies its value into the selected slot on click. */
function RequestedRow({ label, value, canApply, onApply }: { label: string; value?: string; canApply: boolean; onApply: () => void }) {
  const content = (
    <>
      <span className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] shrink-0">{label}</span>
      <span className="text-sm font-bold text-[#1F1F1A] text-right">{value || "—"}</span>
    </>
  );
  if (!canApply || !value) {
    return <div className="flex items-center justify-between gap-4 px-4 sm:px-5 py-3 border-b border-[#E6DFC8] last:border-0">{content}</div>;
  }
  return (
    <button
      type="button"
      onClick={onApply}
      title="Use as the selected slot"
      className="w-full flex items-center justify-between gap-4 px-4 sm:px-5 py-3 border-b border-[#E6DFC8] last:border-0 hover:bg-[#F7F4EA] transition-colors text-left"
    >
      {content}
    </button>
  );
}

/** Contact row whose value links out to the mail app / phone dialer via an icon. */
function ContactRow({ label, value, href, icon: Icon }: { label: string; value: string | null; href: string | null; icon: React.ElementType }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-[#E6DFC8] last:border-0">
      <span className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] shrink-0">{label}</span>
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm font-bold text-[#1F1F1A] text-right truncate">{value || "—"}</span>
        {href && (
          <a
            href={href}
            aria-label={`${label}: ${value}`}
            title={`Open ${label.toLowerCase()}`}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 grid place-items-center w-7 h-7 rounded-lg bg-[#F7F4EA] border border-[#E6DFC8] text-[#5C4033] hover:bg-[#5C4033] hover:text-white transition-colors"
          >
            <Icon className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

/** Collapsible card section — matches the layout/format of the event-setups sheet. */
function Section({
  title,
  defaultOpen = true,
  className,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cn("bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 sm:px-5 py-3 bg-[#F7F4EA] hover:bg-[#F0EDE0] transition-colors text-left"
      >
        <span className="text-[10px] font-black uppercase tracking-wide text-[#5C4033]">{title}</span>
        <ChevronDown className={cn("w-4 h-4 text-[#5F624F] transition-transform duration-200", open && "rotate-180")} />
      </button>
      <div className={cn(!open && "hidden")}>{children}</div>
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
  const editable = status !== "cancelled";

  const currentSub = unwrapSubtype(request.event_subtypes);
  const reasonLabel = privateHireSubtypeLabel(currentSub, request.reason_for_hire);

  // Editable fields — seeded from the request; a cancelled enquiry is read-only.
  const [guestCount, setGuestCount] = useState(String(request.guest_count ?? ""));
  const [reason, setReason] = useState(request.reason ?? "");
  const [typeId, setTypeId] = useState(currentSub?.event_types_id != null ? String(currentSub.event_types_id) : "");
  const [subtypeId, setSubtypeId] = useState(request.event_subtypes_id != null ? String(request.event_subtypes_id) : "");
  const [selectedDate, setSelectedDate] = useState(request.selected_date || "");
  const [selectedStartTime, setSelectedStartTime] = useState(toHHMM(request.selected_start_time));
  const [selectedEndTime, setSelectedEndTime] = useState(toHHMM(request.selected_end_time));
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // Event type/sub-type option lists — fetched once, the first time the sheet opens.
  const [options, setOptions] = useState<PrivateEventOptions | null>(null);
  useEffect(() => {
    if (!open || options) return;
    getPrivateEventOptions().then(setOptions).catch(() => {});
  }, [open, options]);
  const subtypeOptions = (options?.subtypes ?? []).filter((s) => !typeId || String(s.event_types_id) === typeId);

  const origStart = toHHMM(request.selected_start_time);
  const origEnd = toHHMM(request.selected_end_time);
  const hasChanges =
    guestCount !== String(request.guest_count ?? "") ||
    reason !== (request.reason ?? "") ||
    subtypeId !== (request.event_subtypes_id != null ? String(request.event_subtypes_id) : "") ||
    selectedDate !== (request.selected_date || "") ||
    selectedStartTime !== origStart ||
    selectedEndTime !== origEnd ||
    adminNotes !== (request.admin_notes ?? "");

  const editFields = () => ({
    guest_count: guestCount.trim() === "" ? request.guest_count : Number(guestCount),
    reason: reason.trim() === "" ? null : reason,
    event_subtypes_id: subtypeId ? Number(subtypeId) : null,
    selected_date: selectedDate || null,
    selected_start_time: selectedStartTime || null,
    selected_end_time: selectedEndTime || null,
    admin_notes: adminNotes || null,
  });

  const applyDate = (d: string) => setSelectedDate(d);
  // Copy the applicant's requested date/time into the selected slot.
  const applyPreferred = () => {
    if (request.preferred_date) setSelectedDate(request.preferred_date);
    setSelectedStartTime(toHHMM(request.preferred_start_time));
    setSelectedEndTime(toHHMM(request.preferred_end_time));
  };
  // Selecting a type resets the sub-type to the first one under it.
  const onSelectType = (v: string) => {
    setTypeId(v);
    const first = (options?.subtypes ?? []).find((s) => String(s.event_types_id) === v);
    setSubtypeId(first ? String(first.id) : "");
  };

  function resetEdits() {
    setGuestCount(String(request.guest_count ?? ""));
    setReason(request.reason ?? "");
    setTypeId(currentSub?.event_types_id != null ? String(currentSub.event_types_id) : "");
    setSubtypeId(request.event_subtypes_id != null ? String(request.event_subtypes_id) : "");
    setSelectedDate(request.selected_date || "");
    setSelectedStartTime(toHHMM(request.selected_start_time));
    setSelectedEndTime(toHHMM(request.selected_end_time));
    setAdminNotes(request.admin_notes || "");
    setError(null);
  }
  function handleCancel() {
    resetEdits();
    setOpen(false);
  }

  function handleSave() {
    if (!hasChanges) return;
    setError(null);
    startTransition(async () => {
      try {
        await updatePrivateHireFields(request.id, editFields());
        toast.success("Changes saved");
        setOpen(false);
      } catch {
        setError("Failed to save. Please try again.");
      }
    });
  }

  function handleAction(newStatus: "confirmed" | "cancelled") {
    setError(null);
    startTransition(async () => {
      try {
        // Persist any field edits before the status change so the linked event
        // (created on confirm) uses the latest details.
        if (hasChanges) await updatePrivateHireFields(request.id, editFields());
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
            sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-140 lg:w-6xl xl:w-7xl
            sm:h-auto sm:max-h-[80vh] lg:max-h-[90vh] sm:rounded-4xl sm:bottom-6
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
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 min-h-0 touch-pan-y">
            <div className="animate-in fade-in duration-200 space-y-4 sm:space-y-5 lg:grid lg:grid-cols-2 lg:gap-5 lg:space-y-0 lg:items-start">
              {/* Event details */}
              <Section title="Event Details">
                <SheetRow label="Reason for Hire" value={reasonLabel} />
                <EditRow label="Reason" value={reason} onChange={setReason} editable={editable} placeholder="Add a reason…" />
                <EditRow label="Guests" value={guestCount} onChange={setGuestCount} editable={editable} type="number" placeholder="0" readOnlyValue={request.guest_count} />
              </Section>

              {/* Contact — icons link out to the mail app / phone dialer */}
              <Section title="Contact">
                <SheetRow label="Name" value={request.full_name} />
                <ContactRow label="Email" value={request.email} href={request.email ? `mailto:${request.email}` : null} icon={Mail} />
                <ContactRow label="Phone" value={request.phone_no} href={request.phone_no ? `tel:${request.phone_no.replace(/\s+/g, "")}` : null} icon={Phone} />
              </Section>

              {/* Requested time — click a row to copy it into the selected slot */}
              <Section title="Requested Time">
                <RequestedRow
                  label="Date"
                  value={formatDate(request.preferred_date)}
                  canApply={editable && !!request.preferred_date}
                  onApply={() => request.preferred_date && applyDate(request.preferred_date)}
                />
                <RequestedRow
                  label="Time"
                  value={formatTimeRange(request.preferred_start_time, request.preferred_end_time)}
                  canApply={editable && !!(request.preferred_start_time || request.preferred_end_time)}
                  onApply={() => {
                    setSelectedStartTime(toHHMM(request.preferred_start_time));
                    setSelectedEndTime(toHHMM(request.preferred_end_time));
                  }}
                />
                {editable && (request.preferred_date || request.preferred_start_time) && (
                  <button
                    type="button"
                    onClick={applyPreferred}
                    className="w-full flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 text-[10px] font-black uppercase tracking-wide text-[#5C4033] hover:bg-[#F7F4EA] transition-colors"
                  >
                    <CalendarDays className="w-3.5 h-3.5" /> Use requested date &amp; time
                  </button>
                )}
              </Section>

              {/* Selected time — editable: calendar popover + time inputs */}
              <Section title="Selected Time">
                <div className="flex items-center justify-between gap-4 px-4 sm:px-5 py-3 border-b border-[#E6DFC8]">
                  <span className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] shrink-0">Date</span>
                  {editable ? (
                    <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                      <PopoverTrigger asChild>
                        <button type="button" className="inline-flex items-center gap-2 text-sm font-bold text-[#1F1F1A] hover:text-[#5C4033] transition-colors">
                          {selectedDate ? format(new Date(selectedDate + "T00:00:00"), "EEE, d MMM yyyy") : "Pick a date"}
                          <CalendarDays className="w-4 h-4 text-[#5F624F]/60 shrink-0" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-auto p-0 bg-white border-2 border-[#E6DFC8] rounded-2xl">
                        <Calendar
                          mode="single"
                          selected={selectedDate ? new Date(selectedDate + "T00:00:00") : undefined}
                          onSelect={(d) => {
                            if (d) applyDate(format(d, "yyyy-MM-dd"));
                            setDatePickerOpen(false);
                          }}
                          autoFocus
                        />
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <span className="text-sm font-bold text-[#1F1F1A] text-right">{formatDate(request.selected_date) || "—"}</span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-4 px-4 sm:px-5 py-3 border-b border-[#E6DFC8] last:border-0">
                  <span className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] shrink-0">Time</span>
                  {editable ? (
                    <div className="flex items-center gap-1.5">
                      <input type="time" aria-label="Selected start time" value={selectedStartTime} onChange={(e) => setSelectedStartTime(e.target.value)} className="bg-transparent outline-none text-sm font-bold text-[#1F1F1A] text-right" />
                      <span className="text-[#5F624F]/50 text-xs">-</span>
                      <input type="time" aria-label="Selected end time" value={selectedEndTime} onChange={(e) => setSelectedEndTime(e.target.value)} className="bg-transparent outline-none text-sm font-bold text-[#1F1F1A] text-right" />
                    </div>
                  ) : (
                    <span className="text-sm font-bold text-[#1F1F1A] text-right">{formatTimeRange(request.selected_start_time, request.selected_end_time) || "—"}</span>
                  )}
                </div>
              </Section>

              {/* Additional requirements */}
              {request.additional_requirements && (
                <Section title="Additional Requirements" className="lg:col-span-2">
                  <p className="px-4 sm:px-5 py-3 text-sm text-[#1F1F1A]">
                    {request.additional_requirements}
                  </p>
                </Section>
              )}

              {/* System information — classification + audit trail; collapsed by default */}
              <Section title="System Information" defaultOpen={false} className="lg:col-span-2">
                {options ? (
                  <>
                    <EditRow
                      label="Event Type"
                      value={typeId}
                      onChange={onSelectType}
                      editable={editable}
                      options={options.types.map((t) => ({ value: String(t.id), label: toTitleCase(t.name) }))}
                      readOnlyValue={toTitleCase(options.types.find((t) => String(t.id) === typeId)?.name) || "—"}
                    />
                    <EditRow
                      label="Event Subtype"
                      value={subtypeId}
                      onChange={setSubtypeId}
                      editable={editable}
                      options={subtypeOptions.map((s) => ({ value: String(s.id), label: toTitleCase(s.name) }))}
                      readOnlyValue={toTitleCase(subtypeOptions.find((s) => String(s.id) === subtypeId)?.name ?? currentSub?.name) || "—"}
                    />
                  </>
                ) : (
                  <SheetRow label="Event Type" value={reasonLabel} />
                )}
                <SheetRow label="Submitted" value={formatDateTime(request.created_at)} />
                <SheetRow label="Last Modified" value={formatDateTime(request.updated_at)} />
                <SheetRow label="Modified By" value={request.updated_by_employee?.full_name || "—"} />
              </Section>

              {/* Admin notes (read-only once cancelled; pending & confirmed edit it in the footer) */}
              {status === "cancelled" && request.admin_notes && (
                <Section title="Admin Notes" className="lg:col-span-2">
                  <div className="px-4 sm:px-5 py-3">
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
                </Section>
              )}
            </div>
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
                      disabled={isPending || !selectedDate}
                      title={!selectedDate ? "Set a selected date before confirming" : undefined}
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
                      Reject
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

                {/* Discard / Save edits */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isPending}
                    className="flex-1 flex items-center justify-center bg-white border-2 border-[#E6DFC8] text-[#5F624F] font-black text-[10px] uppercase tracking-wide rounded-2xl py-3 disabled:opacity-50"
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isPending || !hasChanges}
                    className="flex-1 flex items-center justify-center gap-2 bg-[#1B4332] hover:bg-[#1B4332]/85 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl py-3 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
