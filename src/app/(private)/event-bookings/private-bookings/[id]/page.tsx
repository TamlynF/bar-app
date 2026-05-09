import React from "react";
import { notFound } from "next/navigation";
import { getPrivateHireById } from "../actions";
import PrivateHireDetailClient from "./private-hire-detail-client";
import BackButton from "@/components/ui/back-button";
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
  pending_review: {
    label: "Pending Review",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    icon: Clock,
  },
  confirmed: {
    label: "Confirmed",
    badge: "bg-green-50 text-green-700 border-green-200",
    icon: CheckCircle,
  },
  rejected: {
    label: "Rejected",
    badge: "bg-red-50 text-red-700 border-red-200",
    icon: XCircle,
  },
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-[#E6DFC8] last:border-0">
      <span className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] shrink-0 pt-0.5">
        {label}
      </span>
      <span className="text-sm font-bold text-[#1F1F1A] text-right">{value || "—"}</span>
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

  const cfg = STATUS_STYLES[request.status] ?? STATUS_STYLES.pending_review;
  const StatusIcon = cfg.icon;

  // Resolve date/time — schema has both preferred_* and selected_* variants
  const displayDate =
    (request as Record<string, unknown>).selected_date as string | null ??
    (request as Record<string, unknown>).preferred_date as string | null;
  const displayStartTime =
    (request as Record<string, unknown>).selected_start_time as string | null ??
    (request as Record<string, unknown>).preferred_time as string | null;
  const displayEndTime =
    (request as Record<string, unknown>).selected_end_time as string | null;
  const depositAmount =
    (request as Record<string, unknown>).deposit_amount as number | null;
  const paidAmount =
    (request as Record<string, unknown>).paid_amount as number | null;

  return (
    <div className="flex-1 bg-background min-h-screen">
      <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">

        {/* Back link + header */}
        <div className="space-y-3">

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-black text-[#1F1F1A] uppercase tracking-tight leading-tight">
                {request.full_name}
              </h1>
              <p className="text-sm text-[#5F624F] mt-0.5">{request.reason || request.reason_for_hire}</p>
            </div>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider shrink-0",
                cfg.badge
              )}
            >
              <StatusIcon className="w-3.5 h-3.5" />
              {cfg.label}
            </span>
          </div>
        </div>

        {/* Event details + Contact — two-column on sm+ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Event details */}
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#5F624F]">
              Event Details
            </p>
            <div className="bg-white border border-[#E6DFC8] rounded-2xl px-4 overflow-hidden shadow-sm">
              {displayDate && (
                <div className="flex items-start justify-between gap-4 py-3 border-b border-[#E6DFC8]">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] shrink-0 pt-0.5 flex items-center gap-1.5">
                    <CalendarDays className="w-3 h-3" /> Date
                  </span>
                  <span className="text-sm font-bold text-[#1F1F1A] text-right">
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
              <div className="flex items-start justify-between gap-4 py-3 border-b border-[#E6DFC8]">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] shrink-0 pt-0.5 flex items-center gap-1.5">
                  <Users className="w-3 h-3" /> Guests
                </span>
                <span className="text-sm font-bold text-[#1F1F1A]">
                  {request.guest_count}
                </span>
              </div>
              <DetailRow label="Reason for Hire" value={request.reason || request.reason_for_hire} />
              {depositAmount != null && (
                <div className="flex items-start justify-between gap-4 py-3 border-b border-[#E6DFC8] last:border-0">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] shrink-0 pt-0.5 flex items-center gap-1.5">
                    <DollarSign className="w-3 h-3" /> Deposit
                  </span>
                  <div className="flex items-center gap-2 text-right flex-wrap justify-end">
                    <span className="text-sm font-black text-[#1F1F1A]">
                      £{depositAmount.toFixed(2)}
                    </span>
                    {paidAmount != null && (
                      <span className={cn(
                        "text-[9px] font-black uppercase tracking-tight px-1.5 py-0.5 rounded border",
                        paidAmount >= depositAmount
                          ? "bg-green-50 border-green-200 text-green-700"
                          : paidAmount > 0
                          ? "bg-amber-50 border-amber-200 text-amber-700"
                          : "bg-red-50 border-red-200 text-red-700"
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
            <p className="text-[10px] font-black uppercase tracking-widest text-[#5F624F]">
              Contact Information
            </p>
            <div className="bg-white border border-[#E6DFC8] rounded-2xl px-4 overflow-hidden shadow-sm">
              <DetailRow label="Name" value={request.full_name} />
              <div className="flex items-start justify-between gap-4 py-3 border-b border-[#E6DFC8]">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] shrink-0 pt-0.5 flex items-center gap-1.5">
                  <Mail className="w-3 h-3" /> Email
                </span>
                <a
                  href={`mailto:${request.email}`}
                  className="text-sm font-bold text-[#26300D] underline underline-offset-2 text-right break-all"
                >
                  {request.email}
                </a>
              </div>
              {request.phone_no && (
                <div className="flex items-start justify-between gap-4 py-3 border-b border-[#E6DFC8]">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] shrink-0 pt-0.5 flex items-center gap-1.5">
                    <Phone className="w-3 h-3" /> Phone
                  </span>
                  <a
                    href={`tel:${request.phone_no}`}
                    className="text-sm font-bold text-[#26300D] underline underline-offset-2"
                  >
                    {request.phone_no}
                  </a>
                </div>
              )}
              <div className="flex items-start justify-between gap-4 py-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] shrink-0 pt-0.5 flex items-center gap-1.5">
                  <CalendarDays className="w-3 h-3" /> Submitted
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
            <p className="text-[10px] font-black uppercase tracking-widest text-[#5F624F]">
              Additional Requirements
            </p>
            <p className="text-sm text-[#1F1F1A] bg-white border border-[#E6DFC8] rounded-2xl px-4 py-3 shadow-sm">
              {request.additional_requirements}
            </p>
          </div>
        )}

        {/* Admin notes — read-only when resolved */}
        {request.status !== "pending_review" && request.admin_notes && (
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#5F624F]">
              Admin Notes
            </p>
            <p className="text-sm text-[#1F1F1A] bg-[#F7F4EA] border border-[#E6DFC8] rounded-2xl px-4 py-3">
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
