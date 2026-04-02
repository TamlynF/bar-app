"use client";

import React, { useState, useTransition } from "react";
import { updateBandStatus } from "../actions";
import {
  ChevronRight,
  Instagram,
  Facebook,
  Youtube,
  Music2,
  Link2,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

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
}

const STATUS_CONFIG: Record<
  string,
  { label: string; cardBorder: string; badge: string; icon: React.ElementType }
> = {
  pending_review: {
    label: "Pending Review",
    cardBorder: "border-l-amber-400",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    icon: Clock,
  },
  confirmed: {
    label: "Confirmed",
    cardBorder: "border-l-green-500",
    badge: "bg-green-50 text-green-700 border-green-200",
    icon: CheckCircle,
  },
  rejected: {
    label: "Rejected",
    cardBorder: "border-l-red-400",
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

function SheetRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-[#E6DFC8] last:border-0">
      <span className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] shrink-0 pt-0.5">
        {label}
      </span>
      <span className="text-sm font-bold text-[#1F1F1A] text-right">{value || "—"}</span>
    </div>
  );
}

export function BandBookingCard({ request }: { request: BandRequest }) {
  const [open, setOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState(request.admin_notes || "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const cfg = STATUS_CONFIG[request.status] ?? STATUS_CONFIG.pending_review;
  const StatusIcon = cfg.icon;

  const socials = request.social_links
    ? Object.entries(request.social_links).filter(([, v]) => v)
    : [];
  const videos = (request.video_urls ?? []).filter(Boolean);
  const dates = (request.preferred_dates ?? []).filter(Boolean);

  function handleAction(status: "confirmed" | "rejected") {
    setError(null);
    startTransition(async () => {
      try {
        await updateBandStatus(request.id, status, adminNotes || undefined);
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
          "w-full bg-white rounded-2xl border border-[#E6DFC8] border-l-4 overflow-hidden",
          "flex items-center gap-3 px-4 py-3.5 text-left",
          "hover:bg-[#F7F4EA]/60 transition-colors active:scale-[0.99]",
          cfg.cardBorder
        )}
      >
        {/* Left — names */}
        <div className="flex-1 min-w-0">
          <p className="font-black text-sm text-[#1F1F1A] uppercase tracking-tight truncate">
            {request.group_name || request.booker_name}
          </p>
          <p className="text-xs text-[#5F624F] truncate mt-0.5">{request.booker_name}</p>
        </div>

        {/* Type pill */}
        {request.type && (
          <span className="hidden sm:inline-flex shrink-0 px-2.5 py-1 rounded-lg bg-[#F7F4EA] border border-[#E6DFC8] text-[10px] font-black uppercase tracking-widest text-[#5F624F]">
            {request.type}
          </span>
        )}

        {/* Status badge */}
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider shrink-0",
            cfg.badge
          )}
        >
          <StatusIcon className="w-3 h-3" />
          {cfg.label}
        </span>

        <ChevronRight className="w-4 h-4 text-[#5F624F] shrink-0" />
      </button>

      {/* Bottom sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl max-h-[90dvh] overflow-y-auto p-0 border-t border-[#E6DFC8]"
        >
          {/* Sheet header */}
          <div className="sticky top-0 bg-white z-10 px-5 pt-5 pb-4 border-b border-[#E6DFC8]">
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
                  cfg.badge
                )}
              >
                <StatusIcon className="w-3 h-3" />
                {cfg.label}
              </span>
            </div>
          </div>

          <div className="px-5 py-4 space-y-6">
            {/* Booker info */}
            <div className="bg-white border border-[#E6DFC8] rounded-2xl px-4 overflow-hidden">
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

            {/* Event details */}
            <div className="bg-white border border-[#E6DFC8] rounded-2xl px-4 overflow-hidden">
              <SheetRow label="Type" value={request.type} />
              <SheetRow label="Genre" value={request.genre} />
              <SheetRow
                label="Preferred Dates"
                value={dates.length > 0 ? dates.join(", ") : null}
              />
            </div>

            {/* Social links */}
            {socials.length > 0 && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] mb-2">
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
                        className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#E6DFC8] rounded-xl text-xs font-bold text-[#26300D] hover:bg-[#F7F4EA] transition-colors"
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
                <p className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] mb-2">
                  Performance Videos
                </p>
                <div className="space-y-3">
                  {videos.map((url, i) => {
                    const isStorage =
                      url.includes("supabase.co/storage") || url.includes(".supabase.co");
                    return isStorage ? (
                      <video
                        key={i}
                        src={url}
                        controls
                        className="w-full rounded-2xl bg-black max-h-56 object-contain"
                        preload="metadata"
                      />
                    ) : (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-3 bg-white border border-[#E6DFC8] rounded-xl text-xs font-bold text-[#26300D] hover:bg-[#F7F4EA] transition-colors truncate"
                      >
                        <Link2 className="w-3.5 h-3.5 shrink-0" />
                        {url}
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Notes from applicant */}
            {request.notes && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] mb-2">
                  Notes from Applicant
                </p>
                <p className="text-sm text-[#1F1F1A] bg-[#F7F4EA] border border-[#E6DFC8] rounded-2xl px-4 py-3">
                  {request.notes}
                </p>
              </div>
            )}

            {/* Admin notes (read-only, resolved) */}
            {request.status !== "pending_review" && request.admin_notes && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] mb-2">
                  Admin Notes
                </p>
                <p className="text-sm text-[#1F1F1A] bg-[#F7F4EA] border border-[#E6DFC8] rounded-2xl px-4 py-3">
                  {request.admin_notes}
                </p>
              </div>
            )}

            {/* Action area — pending only */}
            {request.status === "pending_review" && (
              <div className="space-y-3 pt-2 border-t border-[#E6DFC8]">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[#5F624F] mb-1.5">
                    Note to Applicant (optional)
                  </label>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Add a message to include in the outcome email…"
                    rows={2}
                    className="w-full bg-[#F7F4EA] border border-[#E6DFC8] rounded-2xl px-4 py-3 text-sm text-[#1F1F1A] placeholder:text-[#5F624F]/50 focus:outline-none focus:border-[#26300D]/30 resize-none transition-all"
                  />
                </div>

                {error && <p className="text-red-500 text-xs font-bold">{error}</p>}

                <div className="flex gap-2 pb-2">
                  <button
                    type="button"
                    onClick={() => handleAction("confirmed")}
                    disabled={isPending}
                    className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl py-3 transition-all disabled:opacity-50"
                  >
                    {isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle className="w-3.5 h-3.5" />
                    )}
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAction("rejected")}
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
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
