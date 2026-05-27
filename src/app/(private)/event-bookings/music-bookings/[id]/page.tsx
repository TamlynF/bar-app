import React from "react";
import { notFound } from "next/navigation";
import { getBandBookingById } from "../actions";
import BandDetailClient from "./band-detail-client";
import BackButton from "@/components/ui/back-button";
import {
  CheckCircle,
  XCircle,
  Clock,
  Instagram,
  Facebook,
  Youtube,
  Music2,
  Link2,
  CalendarDays,
  Phone,
  Mail,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_CONFIG: Record<
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

const SOCIAL_ICONS: Record<string, React.ElementType> = {
  instagram: Instagram,
  facebook: Facebook,
  youtube: Youtube,
  tiktok: Music2,
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
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

function formatTime(t?: string | null): string {
  if (!t) return "—";
  const [hh, mm] = t.split(":");
  const h = parseInt(hh, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${mm} ${ampm}`;
}

export default async function BandBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let request;
  try {
    request = await getBandBookingById(id);
  } catch {
    notFound();
  }

  const cfg = STATUS_CONFIG[request.status] ?? STATUS_CONFIG.pending_review;
  const StatusIcon = cfg.icon;

  const socials = request.social_links
    ? Object.entries(request.social_links as Record<string, string>).filter(([, v]) => v)
    : [];

  const dates = ((request.preferred_dates as string[] | null) ?? []).filter(Boolean);

  return (
    <div className="flex-1 bg-background min-h-screen">
      <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">

        {/* Back link + header */}
        <div className="space-y-3">
          {/* <div className="hidden sm:block">
            <BackButton label="All Band Applications" />
          </div> */}

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-black text-[#1F1F1A] uppercase tracking-tight leading-tight">
                {request.group_name || request.booker_name}
              </h1>
              {request.group_name && (
                <p className="text-sm text-[#5F624F] mt-0.5">{request.booker_name}</p>
              )}
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
            <p className="text-[10px] font-black uppercase tracking-wide text-[#5F624F]">
              Event Details
            </p>
            <div className="bg-white border border-[#E6DFC8] rounded-2xl px-4 overflow-hidden shadow-sm">
              <DetailRow label="Act Name" value={request.group_name} />
              <DetailRow label="Type" value={toTitleCase(request.type)} />
              <DetailRow label="Genre" value={toTitleCase(request.genre)} />
              {request.selected_date && (
                <DetailRow
                  label="Date"
                  value={new Date(request.selected_date).toLocaleDateString("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                />
              )}
              {(request.selected_start_time || request.selected_end_time) && (
                <DetailRow
                  label="Time"
                  value={`${formatTime(request.selected_start_time)} – ${formatTime(request.selected_end_time)}`}
                />
              )}
              {request.payment_amount != null && (
                <div className="flex items-start justify-between gap-4 py-3 border-b border-[#E6DFC8] last:border-0">
                  <span className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] shrink-0 pt-0.5">
                    Payment
                  </span>
                  <div className="flex items-center gap-1.5 text-right">
                    <DollarSign className="w-3.5 h-3.5 text-[#5F624F] opacity-50" />
                    <span className="text-sm font-black text-[#1F1F1A]">
                      £{request.payment_amount.toFixed(2)}
                    </span>
                    {request.payment_status && (
                      <span className={cn(
                        "text-[9px] font-black uppercase tracking-tight px-1.5 py-0.5 rounded border",
                        request.payment_status === "paid"
                          ? "bg-green-50 border-green-200 text-green-700"
                          : "bg-amber-50 border-amber-200 text-amber-700"
                      )}>
                        {request.payment_status}
                      </span>
                    )}
                  </div>
                </div>
              )}
              {dates.length > 0 ? (
                <div className="flex items-start justify-between gap-4 py-3">
                  <span className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] shrink-0 pt-0.5">
                    Preferred Dates
                  </span>
                  <ul className="text-right space-y-1">
                    {dates.map((d, i) => (
                      <li key={i} className="text-sm font-bold text-[#1F1F1A]">
                        {new Date(d).toLocaleDateString("en-GB", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <DetailRow label="Preferred Dates" value={null} />
              )}
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wide text-[#5F624F]">
              Contact Information
            </p>
            <div className="bg-white border border-[#E6DFC8] rounded-2xl px-4 overflow-hidden shadow-sm">
              <DetailRow label="Name" value={request.booker_name} />
              <div className="flex items-start justify-between gap-4 py-3 border-b border-[#E6DFC8]">
                <span className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] shrink-0 pt-0.5 flex items-center gap-1.5">
                  <Mail className="w-3 h-3" /> Email
                </span>
                <a
                  href={`mailto:${request.email}`}
                  className="text-sm font-bold text-[#5C4033] underline underline-offset-2 text-right break-all"
                >
                  {request.email}
                </a>
              </div>
              {request.phone_no && (
                <div className="flex items-start justify-between gap-4 py-3 border-b border-[#E6DFC8]">
                  <span className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] shrink-0 pt-0.5 flex items-center gap-1.5">
                    <Phone className="w-3 h-3" /> Phone
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
                <span className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] shrink-0 pt-0.5 flex items-center gap-1.5">
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

            {/* Bank details — only if present */}
            {(request.bank_account_no || request.bank_sort_code) && (
              <div className="space-y-2 mt-2">
                <p className="text-[10px] font-black uppercase tracking-wide text-[#5F624F]">
                  Bank Details
                </p>
                <div className="bg-white border border-[#E6DFC8] rounded-2xl px-4 overflow-hidden shadow-sm">
                  {request.bank_account_name && <DetailRow label="Account Name" value={request.bank_account_name} />}
                  {request.bank_account_no && <DetailRow label="Account No." value={request.bank_account_no} />}
                  {request.bank_sort_code && <DetailRow label="Sort Code" value={request.bank_sort_code} />}
                  {request.bank_payment_ref && <DetailRow label="Payment Ref" value={request.bank_payment_ref} />}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Social links */}
        {socials.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wide text-[#5F624F]">
              Social Media
            </p>
            <div className="flex flex-wrap gap-2">
              {socials.map(([key, url]) => {
                const Icon = SOCIAL_ICONS[key] ?? Link2;
                return (
                  <a
                    key={key}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#E6DFC8] rounded-xl text-xs font-bold text-[#5C4033] hover:bg-[#F7F4EA] transition-colors shadow-sm"
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* Notes from applicant */}
        {request.notes && (
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wide text-[#5F624F]">
              Notes from Applicant
            </p>
            <p className="text-sm text-[#1F1F1A] bg-white border border-[#E6DFC8] rounded-2xl px-4 py-3 shadow-sm">
              {request.notes}
            </p>
          </div>
        )}

        {/* Admin notes — read-only when resolved */}
        {request.status !== "pending_review" && request.admin_notes && (
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wide text-[#5F624F]">
              Admin Notes
            </p>
            <p className="text-sm text-[#1F1F1A] bg-[#F7F4EA] border border-[#E6DFC8] rounded-2xl px-4 py-3">
              {request.admin_notes}
            </p>
          </div>
        )}

        {/* Client component: videos + confirm/reject actions */}
        <BandDetailClient request={request} />

      </div>
    </div>
  );
}
