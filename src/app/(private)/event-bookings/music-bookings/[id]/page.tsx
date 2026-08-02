import React from "react";
import { notFound } from "next/navigation";
import { getBandBookingById } from "../actions";
import BandDetailClient from "./band-detail-client";
import {
  CheckCircle,
  XCircle,
  Clock,
  Inbox,
  Send,
  Link2,
  CalendarDays,
  Phone,
  Mail,
  DollarSign,
} from "lucide-react";
import { SiInstagram, SiFacebook, SiYoutube, SiTiktok } from "react-icons/si";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_CONFIG: Record<
  string,
  { label: string; badge: string; icon: React.ElementType }
> = {
  new: {
    label: "New",
    badge: "bg-sky-50 text-sky-700 border-sky-200",
    icon: Inbox,
  },
  reviewing: {
    label: "Reviewing",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    icon: Clock,
  },
  offered: {
    label: "Offered",
    badge: "bg-purple-50 text-purple-700 border-purple-200",
    icon: Send,
  },
  booked: {
    label: "Booked",
    badge: "bg-green-50 text-green-700 border-green-200",
    icon: CheckCircle,
  },
  declined: {
    label: "Declined",
    badge: "bg-red-50 text-red-700 border-red-200",
    icon: XCircle,
  },
};

const SOCIAL_ICONS: Record<string, React.ElementType> = {
  instagram: SiInstagram,
  facebook: SiFacebook,
  youtube: SiYoutube,
  tiktok: SiTiktok,
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#E6DFC8] py-3 last:border-0">
      <span className="shrink-0 pt-0.5 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
        {label}
      </span>
      <span className="text-right text-sm font-bold text-[#1F1F1A]">{value || "-"}</span>
    </div>
  );
}

function toTitleCase(str?: string | null) {
  if (!str) return "";
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

function formatTime(t?: string | null): string {
  if (!t) return "-";
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

  const cfg = STATUS_CONFIG[request.status] ?? STATUS_CONFIG.new;
  const StatusIcon = cfg.icon;

  const socials = request.social_links
    ? Object.entries(request.social_links as Record<string, string>).filter(([, v]) => v)
    : [];

  const dates = ((request.preferred_dates as string[] | null) ?? []).filter(Boolean);

  return (
    <div className="min-h-screen flex-1 bg-background">
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-4 sm:py-0 md:px-8">

        <div className="space-y-3">

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-black text-2xl leading-tight tracking-tight text-[#1F1F1A] uppercase">
                {request.group_name || request.booker_name}
              </h1>
              {request.group_name && (
                <p className="mt-0.5 text-sm text-[#5F624F]">{request.booker_name}</p>
              )}
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

          <div className="space-y-2">
            <p className="font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
              Event Details
            </p>
            <div className="overflow-hidden rounded-2xl border border-[#E6DFC8] bg-white px-4 shadow-sm">
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
                <div className="flex items-start justify-between gap-4 border-b border-[#E6DFC8] py-3 last:border-0">
                  <span className="shrink-0 pt-0.5 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
                    Payment
                  </span>
                  <div className="flex items-center gap-1.5 text-right">
                    <DollarSign className="h-3.5 w-3.5 text-[#5F624F] opacity-50" />
                    <span className="font-black text-sm text-[#1F1F1A]">
                      £{request.payment_amount.toFixed(2)}
                    </span>
                    {request.payment_status && (
                      <span className={cn(
                        "rounded border px-1.5 py-0.5 font-black text-[9px] tracking-tight uppercase",
                        request.payment_status === "paid"
                          ? "border-green-200 bg-green-50 text-green-700"
                          : "border-amber-200 bg-amber-50 text-amber-700"
                      )}>
                        {request.payment_status}
                      </span>
                    )}
                  </div>
                </div>
              )}
              {dates.length > 0 ? (
                <div className="flex items-start justify-between gap-4 py-3">
                  <span className="shrink-0 pt-0.5 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
                    Preferred Dates
                  </span>
                  <ul className="space-y-1 text-right">
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

          <div className="space-y-2">
            <p className="font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
              Contact Information
            </p>
            <div className="overflow-hidden rounded-2xl border border-[#E6DFC8] bg-white px-4 shadow-sm">
              <DetailRow label="Name" value={request.booker_name} />
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

            {(request.bank_account_no || request.bank_sort_code) && (
              <div className="mt-2 space-y-2">
                <p className="font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
                  Bank Details
                </p>
                <div className="overflow-hidden rounded-2xl border border-[#E6DFC8] bg-white px-4 shadow-sm">
                  {request.bank_account_name && <DetailRow label="Account Name" value={request.bank_account_name} />}
                  {request.bank_account_no && <DetailRow label="Account No." value={request.bank_account_no} />}
                  {request.bank_sort_code && <DetailRow label="Sort Code" value={request.bank_sort_code} />}
                  {request.bank_payment_ref && <DetailRow label="Payment Ref" value={request.bank_payment_ref} />}
                </div>
              </div>
            )}
          </div>
        </div>

        {socials.length > 0 && (
          <div className="space-y-2">
            <p className="font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
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
                    className="flex items-center gap-1.5 rounded-xl border border-[#E6DFC8] bg-white px-3 py-2 text-xs font-bold text-[#5C4033] shadow-sm transition-colors hover:bg-[#F7F4EA]"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {request.notes && (
          <div className="space-y-2">
            <p className="font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
              Notes from Applicant
            </p>
            <p className="rounded-2xl border border-[#E6DFC8] bg-white px-4 py-3 text-sm text-[#1F1F1A] shadow-sm">
              {request.notes}
            </p>
          </div>
        )}

        {(request.status === "booked" || request.status === "declined") && request.admin_notes && (
          <div className="space-y-2">
            <p className="font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
              Admin Notes
            </p>
            <p className="rounded-2xl border border-[#E6DFC8] bg-[#F7F4EA] px-4 py-3 text-sm text-[#1F1F1A]">
              {request.admin_notes}
            </p>
          </div>
        )}

        <BandDetailClient request={request} />

      </div>
    </div>
  );
}
