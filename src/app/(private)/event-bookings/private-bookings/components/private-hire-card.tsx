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
  updated_by_employee?: { full_name: string | null } | null;
}

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
    icon: <Clock className="h-5 w-5" />,
    label: "Pending",
  },
  confirmed: {
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
    dot: "bg-green-500",
    icon: <CheckCircle className="h-5 w-5" />,
    label: "Confirmed",
  },
  cancelled: {
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    dot: "bg-red-500",
    icon: <XCircle className="h-5 w-5" />,
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
    <div className="flex items-start justify-between gap-4 border-b border-[#E6DFC8] px-4 py-3 last:border-0 sm:px-5">
      <span className="shrink-0 pt-0.5 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
        {label}
      </span>
      <span className="text-right text-sm font-bold text-[#1F1F1A]">{value || "—"}</span>
    </div>
  );
}

function toTitleCase(s?: string | null): string {
  if (!s) return "";
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

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
    <div className="flex items-center justify-between gap-3 border-b border-[#E6DFC8] px-4 py-3 last:border-0 sm:px-5">
      <span className="shrink-0 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">{label}</span>
      {!editable ? (
        <span className="min-w-0 flex-1 truncate text-right text-sm font-bold text-[#1F1F1A]">{readOnlyValue ?? (value || "—")}</span>
      ) : options ? (
        <select
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 cursor-pointer bg-transparent text-right text-sm font-bold text-[#1F1F1A] outline-none [text-align-last:right]"
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
          className="min-w-0 flex-1 bg-transparent text-right text-sm font-bold text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/40"
        />
      )}
    </div>
  );
}

function RequestedRow({ label, value, canApply, onApply }: { label: string; value?: string; canApply: boolean; onApply: () => void }) {
  const content = (
    <>
      <span className="shrink-0 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">{label}</span>
      <span className="text-right text-sm font-bold text-[#1F1F1A]">{value || "—"}</span>
    </>
  );
  if (!canApply || !value) {
    return <div className="flex items-center justify-between gap-4 border-b border-[#E6DFC8] px-4 py-3 last:border-0 sm:px-5">{content}</div>;
  }
  return (
    <button
      type="button"
      onClick={onApply}
      title="Use as the selected slot"
      className="flex w-full items-center justify-between gap-4 border-b border-[#E6DFC8] px-4 py-3 text-left transition-colors last:border-0 hover:bg-[#F7F4EA] sm:px-5"
    >
      {content}
    </button>
  );
}

function ContactRow({ label, value, href, icon: Icon }: { label: string; value: string | null; href: string | null; icon: React.ElementType }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#E6DFC8] px-4 py-3 last:border-0 sm:px-5">
      <span className="shrink-0 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">{label}</span>
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-right text-sm font-bold text-[#1F1F1A]">{value || "—"}</span>
        {href && (
          <a
            href={href}
            aria-label={`${label}: ${value}`}
            title={`Open ${label.toLowerCase()}`}
            onClick={(e) => e.stopPropagation()}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[#E6DFC8] bg-[#F7F4EA] text-[#5C4033] transition-colors hover:bg-[#5C4033] hover:text-white"
          >
            <Icon className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

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
    <div className={cn("overflow-hidden rounded-3xl border-2 border-[#E6DFC8] bg-white", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between bg-[#F7F4EA] px-4 py-3 text-left transition-colors hover:bg-[#F0EDE0] sm:px-5"
      >
        <span className="font-black text-[10px] tracking-wide text-[#5C4033] uppercase">{title}</span>
        <ChevronDown className={cn("h-4 w-4 text-[#5F624F] transition-transform duration-200", open && "rotate-180")} />
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

  const [guestCount, setGuestCount] = useState(String(request.guest_count ?? ""));
  const [reason, setReason] = useState(request.reason ?? "");
  const [typeId, setTypeId] = useState(currentSub?.event_types_id != null ? String(currentSub.event_types_id) : "");
  const [subtypeId, setSubtypeId] = useState(request.event_subtypes_id != null ? String(request.event_subtypes_id) : "");
  const [selectedDate, setSelectedDate] = useState(request.selected_date || "");
  const [selectedStartTime, setSelectedStartTime] = useState(toHHMM(request.selected_start_time));
  const [selectedEndTime, setSelectedEndTime] = useState(toHHMM(request.selected_end_time));
  const [datePickerOpen, setDatePickerOpen] = useState(false);

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
  const applyPreferred = () => {
    if (request.preferred_date) setSelectedDate(request.preferred_date);
    setSelectedStartTime(toHHMM(request.preferred_start_time));
    setSelectedEndTime(toHHMM(request.preferred_end_time));
  };
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "w-full overflow-hidden rounded-2xl border-2 border-[#E6DFC8] bg-white",
          "flex items-center gap-3 px-3 py-3.5 text-left",
          "shadow-sm transition-all hover:bg-[#F7F4EA]/60 active:scale-[0.98]"
        )}
      >
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border",
            theme.bg,
            theme.text,
            theme.border
          )}
        >
          {theme.icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="truncate font-black text-sm tracking-tight text-[#1F1F1A] uppercase">
              {request.full_name}
            </p>
            {request.admin_notes && (
              <span className="shrink-0 rounded border border-purple-200 bg-purple-50 px-1.5 py-0.5 font-black text-[10px] text-purple-700 uppercase">
                ADMIN
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[#5F624F]">
            <p className="truncate text-xs font-semibold">{request.email}</p>
            <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold opacity-60">
              <Users className="h-3 w-3" />
              {request.guest_count}
            </span>
          </div>
        </div>

        <ChevronRight className="h-4 w-4 shrink-0 text-[#5F624F]/50" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="flex h-[85vh] flex-col rounded-t-[2.5rem] border-t-2 border-[#E6DFC8]
            bg-[#F7F4EA] p-0 shadow-2xl outline-none
            sm:inset-x-auto sm:bottom-6 sm:left-1/2 sm:h-auto sm:max-h-[80vh] sm:w-140
            sm:-translate-x-1/2 sm:rounded-4xl sm:border-2 sm:border-[#E6DFC8] lg:max-h-[90vh]
            lg:w-6xl xl:w-7xl"
        >
          <div className="sticky top-0 z-30 shrink-0 border-b border-[#E6DFC8] bg-white/80 p-4 pb-3 backdrop-blur-md sm:rounded-t-4xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <SheetTitle className="truncate font-black text-lg leading-tight tracking-tight text-[#1F1F1A] uppercase">
                  {request.full_name}
                </SheetTitle>
                <p className="mt-0.5 text-xs text-[#5F624F]">{request.email}</p>
              </div>
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 font-black text-[10px] tracking-wider uppercase",
                  theme.bg,
                  theme.text,
                  theme.border
                )}
              >
                <span className={cn("h-2 w-2 rounded-full", theme.dot)} />
                {theme.label}
              </span>
            </div>
          </div>

          <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
            <div className="animate-in space-y-4 duration-200 fade-in sm:space-y-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-5 lg:space-y-0">
              <Section title="Event Details">
                <SheetRow label="Reason for Hire" value={reasonLabel} />
                <EditRow label="Reason" value={reason} onChange={setReason} editable={editable} placeholder="Add a reason…" />
                <EditRow label="Guests" value={guestCount} onChange={setGuestCount} editable={editable} type="number" placeholder="0" readOnlyValue={request.guest_count} />
              </Section>

              <Section title="Contact">
                <SheetRow label="Name" value={request.full_name} />
                <ContactRow label="Email" value={request.email} href={request.email ? `mailto:${request.email}` : null} icon={Mail} />
                <ContactRow label="Phone" value={request.phone_no} href={request.phone_no ? `tel:${request.phone_no.replace(/\s+/g, "")}` : null} icon={Phone} />
              </Section>

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
                    className="flex w-full items-center justify-center gap-2 px-4 py-2.5 font-black text-[10px] tracking-wide text-[#5C4033] uppercase transition-colors hover:bg-[#F7F4EA] sm:px-5"
                  >
                    <CalendarDays className="h-3.5 w-3.5" /> Use requested date &amp; time
                  </button>
                )}
              </Section>

              <Section title="Selected Time">
                <div className="flex items-center justify-between gap-4 border-b border-[#E6DFC8] px-4 py-3 sm:px-5">
                  <span className="shrink-0 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">Date</span>
                  {editable ? (
                    <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                      <PopoverTrigger asChild>
                        <button type="button" className="inline-flex items-center gap-2 text-sm font-bold text-[#1F1F1A] transition-colors hover:text-[#5C4033]">
                          {selectedDate ? format(new Date(selectedDate + "T00:00:00"), "EEE, d MMM yyyy") : "Pick a date"}
                          <CalendarDays className="h-4 w-4 shrink-0 text-[#5F624F]/60" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-auto rounded-2xl border-2 border-[#E6DFC8] bg-white p-0">
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
                    <span className="text-right text-sm font-bold text-[#1F1F1A]">{formatDate(request.selected_date) || "—"}</span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-[#E6DFC8] px-4 py-3 last:border-0 sm:px-5">
                  <span className="shrink-0 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">Time</span>
                  {editable ? (
                    <div className="flex items-center gap-1.5">
                      <input type="time" aria-label="Selected start time" value={selectedStartTime} onChange={(e) => setSelectedStartTime(e.target.value)} className="bg-transparent text-right text-sm font-bold text-[#1F1F1A] outline-none" />
                      <span className="text-xs text-[#5F624F]/50">-</span>
                      <input type="time" aria-label="Selected end time" value={selectedEndTime} onChange={(e) => setSelectedEndTime(e.target.value)} className="bg-transparent text-right text-sm font-bold text-[#1F1F1A] outline-none" />
                    </div>
                  ) : (
                    <span className="text-right text-sm font-bold text-[#1F1F1A]">{formatTimeRange(request.selected_start_time, request.selected_end_time) || "—"}</span>
                  )}
                </div>
              </Section>

              {request.additional_requirements && (
                <Section title="Additional Requirements" className="lg:col-span-2">
                  <p className="px-4 py-3 text-sm text-[#1F1F1A] sm:px-5">
                    {request.additional_requirements}
                  </p>
                </Section>
              )}

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

              {status === "cancelled" && request.admin_notes && (
                <Section title="Admin Notes" className="lg:col-span-2">
                  <div className="px-4 py-3 sm:px-5">
                    <div className="rounded-2xl border border-[#5C4033]/15 bg-[#5C4033]/5 p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <MessageSquareQuote className="h-4 w-4 text-[#5C4033] opacity-40" />
                        <span className="font-black text-[10px] tracking-wide text-[#5C4033] uppercase">
                          Staff Note
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed text-[#1F1F1A] italic">
                        &quot;{request.admin_notes}&quot;
                      </p>
                    </div>
                  </div>
                </Section>
              )}
            </div>
            <div className="h-4" />
          </div>

          {(status === "pending" || status === "confirmed") && (
            <div className="z-40 shrink-0 border-t-2 border-[#E6DFC8] bg-white/80 px-6 py-5 pb-10 backdrop-blur-md sm:rounded-b-4xl sm:pb-5">
              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
                    Note to Enquirer (optional)
                  </label>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Add a message to include in the outcome email..."
                    rows={2}
                    className="w-full resize-none rounded-2xl border border-[#E6DFC8] bg-[#F7F4EA] px-4 py-3 text-sm text-[#1F1F1A] transition-all placeholder:text-[#5F624F]/50 focus:border-[#5C4033]/30 focus:outline-none"
                  />
                </div>

                {error && <p className="text-xs font-bold text-red-500">{error}</p>}

                {status === "pending" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleAction("confirmed")}
                      disabled={isPending || !selectedDate}
                      title={!selectedDate ? "Set a selected date before confirming" : undefined}
                      className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-green-600 font-black text-[10px] tracking-widest text-white uppercase transition-all hover:bg-green-700 active:scale-95 disabled:opacity-50"
                    >
                      {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAction("cancelled")}
                      disabled={isPending}
                      className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 font-black text-[10px] tracking-widest text-red-700 uppercase transition-all hover:bg-red-100 disabled:opacity-50"
                    >
                      {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                      Reject
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleAction("cancelled")}
                    disabled={isPending}
                    className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 font-black text-[10px] tracking-widest text-red-700 uppercase transition-all hover:bg-red-100 disabled:opacity-50"
                  >
                    {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                    Reject
                  </button>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isPending}
                    className="flex h-14 items-center justify-center rounded-2xl border-2 border-[#E6DFC8] bg-white font-black text-[10px] tracking-wide text-[#5F624F] uppercase disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isPending || !hasChanges}
                    className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#1B4332] font-black text-[10px] tracking-widest text-white uppercase shadow-lg hover:bg-[#1B4332]/85 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
                  >
                    {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
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
