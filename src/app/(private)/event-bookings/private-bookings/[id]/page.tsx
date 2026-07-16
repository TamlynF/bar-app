import React from "react";
import { notFound } from "next/navigation";
import { getPrivateHireById } from "../actions";
import PrivateHireDetailClient from "./private-hire-detail-client";
import { privateHireSubtypeLabel, unwrapSubtype } from "@/lib/private-hire-subtype";
import {
  CheckCircle,
  XCircle,
  Clock,
  Users,
  CalendarDays,
  Mail,
  Phone,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<
  string,
  { label: string; badge: string; icon: React.ElementType }
> = {
  pending: {
    label: "Pending Review",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    icon: Clock,
  },
  confirmed: {
    label: "Confirmed",
    badge: "bg-green-50 text-green-700 border-green-200",
    icon: CheckCircle,
  },
  cancelled: {
    label: "Cancelled",
    badge: "bg-red-50 text-red-700 border-red-200",
    icon: XCircle,
  },
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#E6DFC8] py-3 last:border-0">
      <span className="shrink-0 pt-0.5 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
        {label}
      </span>
      <span className="text-right text-sm font-bold text-[#1F1F1A]">{value || "—"}</span>
    </div>
  );
}

function formatTime(t?: string | null): string {
  if (!t) return "—";
  const [hh, mm] = t.split(":");
  const h = parseInt(hh, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${mm} ${ampm}`;
}

function formatDate(d?: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function PrivateHireDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let request;
  try {
    request = await getPrivateHireById(id);
  } catch {
    notFound();
  }

  const cfg = STATUS_STYLES[request.status] ?? STATUS_STYLES.pending;
  const StatusIcon = cfg.icon;
  const reasonLabel = privateHireSubtypeLabel(unwrapSubtype(request.event_subtypes), request.reason_for_hire);

  // Resolve date/time — schema has both preferred_* and selected_* variants
  const displayDate =
    (request as Record<string, unknown>).selected_date as string | null ??
    (request as Record<string, unknown>).preferred_date as string | null;
  const displayStartTime =
    (request as Record<string, unknown>).selected_start_time as string | null ??
    (request as Record<string, unknown>).preferred_start_time as string | null;
  const displayEndTime =
    (request as Record<string, unknown>).selected_end_time as string | null ??
    (request as Record<string, unknown>).preferred_end_time as string | null;
  const depositAmount =
    (request as Record<string, unknown>).deposit_amount as number | null;
  const paidAmount =
    (request as Record<string, unknown>).paid_amount as number | null;

  return (
    <div className="min-h-screen flex-1 bg-background">
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-4 sm:py-0 md:px-8">

        {/* Back link + header */}
        <div className="space-y-3">

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-black text-2xl leading-tight tracking-tight text-[#1F1F1A] uppercase">
                {request.full_name}
              </h1>
              <p className="mt-0.5 text-sm text-[#5F624F]">{reasonLabel}</p>
            </div>
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 font-black text-[10px] tracking-wider uppercase",
                cfg.badge
              )}
            >
              <StatusIcon className="h-3.5 w-3.5" />
              {cfg.label}
            </span>
          </div>
        </div>

        {/* Event details + Contact — two-column on sm+ */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

          {/* Event details */}
          <div className="space-y-2">
            <p className="font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
              Event Details
            </p>
            <div className="overflow-hidden rounded-2xl border border-[#E6DFC8] bg-white px-4 shadow-sm">
              {displayDate && (
                <div className="flex items-start justify-between gap-4 border-b border-[#E6DFC8] py-3">
                  <span className="flex shrink-0 items-center gap-1.5 pt-0.5 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
                    <CalendarDays className="h-3 w-3" /> Date
                  </span>
                  <span className="text-right text-sm font-bold text-[#1F1F1A]">
                    {formatDate(displayDate)}
                  </span>
                </div>
              )}
              {(displayStartTime || displayEndTime) && (
                <DetailRow
                  label="Time"
                  value={`${formatTime(displayStartTime)}${displayEndTime ? ` – ${formatTime(displayEndTime)}` : ""}`}
                />
              )}
              <div className="flex items-start justify-between gap-4 border-b border-[#E6DFC8] py-3">
                <span className="flex shrink-0 items-center gap-1.5 pt-0.5 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
                  <Users className="h-3 w-3" /> Guests
                </span>
                <span className="text-sm font-bold text-[#1F1F1A]">
                  {request.guest_count}
                </span>
              </div>
              <DetailRow label="Reason for Hire" value={reasonLabel} />
              {depositAmount != null && (
                <div className="flex items-start justify-between gap-4 border-b border-[#E6DFC8] py-3 last:border-0">
                  <span className="flex shrink-0 items-center gap-1.5 pt-0.5 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
                    <DollarSign className="h-3 w-3" /> Deposit
                  </span>
                  <div className="flex flex-wrap items-center justify-end gap-2 text-right">
                    <span className="font-black text-sm text-[#1F1F1A]">
                      £{depositAmount.toFixed(2)}
                    </span>
                    {paidAmount != null && (
                      <span className={cn(
                        "rounded border px-1.5 py-0.5 font-black text-[9px] tracking-tight uppercase",
                        paidAmount >= depositAmount
                          ? "border-green-200 bg-green-50 text-green-700"
                          : paidAmount > 0
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : "border-red-200 bg-red-50 text-red-700"
                      )}>
                        £{paidAmount.toFixed(2)} paid
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-2">
            <p className="font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
              Contact Information
            </p>
            <div className="overflow-hidden rounded-2xl border border-[#E6DFC8] bg-white px-4 shadow-sm">
              <DetailRow label="Name" value={request.full_name} />
              <div className="flex items-start justify-between gap-4 border-b border-[#E6DFC8] py-3">
                <span className="flex shrink-0 items-center gap-1.5 pt-0.5 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
                  <Mail className="h-3 w-3" /> Email
                </span>
                <a
                  href={`mailto:${request.email}`}
                  className="text-right text-sm font-bold break-all text-[#5C4033] underline underline-offset-2"
                >
                  {request.email}
                </a>
              </div>
              {request.phone_no && (
                <div className="flex items-start justify-between gap-4 border-b border-[#E6DFC8] py-3">
                  <span className="flex shrink-0 items-center gap-1.5 pt-0.5 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
                    <Phone className="h-3 w-3" /> Phone
                  </span>
                  <a
                    href={`tel:${request.phone_no}`}
                    className="text-sm font-bold text-[#5C4033] underline underline-offset-2"
                  >
                    {request.phone_no}
                  </a>
                </div>
              )}
              <div className="flex items-start justify-between gap-4 py-3">
                <span className="flex shrink-0 items-center gap-1.5 pt-0.5 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
                  <CalendarDays className="h-3 w-3" /> Submitted
                </span>
                <span className="text-sm font-bold text-[#1F1F1A]">
                  {new Date(request.created_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Additional requirements */}
        {request.additional_requirements && (
          <div className="space-y-2">
            <p className="font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
              Additional Requirements
            </p>
            <p className="rounded-2xl border border-[#E6DFC8] bg-white px-4 py-3 text-sm text-[#1F1F1A] shadow-sm">
              {request.additional_requirements}
            </p>
          </div>
        )}

        {/* Admin notes — read-only when resolved */}
        {request.status !== "pending" && request.admin_notes && (
          <div className="space-y-2">
            <p className="font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
              Admin Notes
            </p>
            <p className="rounded-2xl border border-[#E6DFC8] bg-[#F7F4EA] px-4 py-3 text-sm text-[#1F1F1A]">
              {request.admin_notes}
            </p>
          </div>
        )}

        {/* Client component: confirm/reject actions */}
        <PrivateHireDetailClient request={request} />

      </div>
    </div>
  );
}
