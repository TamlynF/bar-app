"use client";

import React, { useState, useTransition } from "react";
import { updateBandStatus } from "../actions";
import { ChevronDown, ChevronUp, Instagram, Facebook, Youtube, Music2, Link2, CheckCircle, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface SocialLinks {
  instagram?: string;
  facebook?: string;
  youtube?: string;
  tiktok?: string;
}

export interface BandRequest {
  id: string;
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

const STATUS_STYLES: Record<string, { label: string; class: string; icon: React.ElementType }> = {
  pending_review: { label: "Pending Review", class: "bg-amber-500/15 text-amber-400 border-amber-500/20", icon: Clock },
  confirmed: { label: "Confirmed", class: "bg-green-500/15 text-green-400 border-green-500/20", icon: CheckCircle },
  rejected: { label: "Rejected", class: "bg-red-500/15 text-red-400 border-red-500/20", icon: XCircle },
};

const SOCIAL_ICONS: Record<string, React.ElementType> = {
  instagram: Instagram,
  facebook: Facebook,
  youtube: Youtube,
  tiktok: Music2,
};

export function BandBookingCard({ request }: { request: BandRequest }) {
  const [expanded, setExpanded] = useState(false);
  const [adminNotes, setAdminNotes] = useState(request.admin_notes || "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const statusStyle = STATUS_STYLES[request.status] ?? STATUS_STYLES.pending_review;
  const StatusIcon = statusStyle.icon;

  function handleAction(status: "confirmed" | "rejected") {
    setError(null);
    startTransition(async () => {
      try {
        await updateBandStatus(request.id, status, adminNotes || undefined);
      } catch {
        setError("Failed to update. Please try again.");
      }
    });
  }

  const socials = request.social_links
    ? Object.entries(request.social_links).filter(([, v]) => v)
    : [];

  const videos = (request.video_urls ?? []).filter(Boolean);
  const dates = (request.preferred_dates ?? []).filter(Boolean);

  return (
    <div className="bg-white rounded-2xl border border-[#E6DFC8] overflow-hidden">
      {/* Summary Row */}
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-[#F7F4EA]/60 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <p className="font-black text-sm text-[#1F1F1A] uppercase tracking-tight truncate">{request.booker_name}</p>
          <p className="text-xs text-[#5F624F] truncate mt-0.5">{request.email}</p>
        </div>

        {dates.length > 0 && (
          <p className="hidden sm:block text-xs text-[#5F624F] shrink-0">{dates[0]}</p>
        )}

        <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider shrink-0", statusStyle.class)}>
          <StatusIcon className="w-3 h-3" />
          {statusStyle.label}
        </span>

        {expanded ? <ChevronUp className="w-4 h-4 text-[#5F624F] shrink-0" /> : <ChevronDown className="w-4 h-4 text-[#5F624F] shrink-0" />}
      </button>

      {/* Expanded Detail */}
      {expanded && (
        <div className="px-5 pb-5 pt-1 border-t border-[#E6DFC8] space-y-4">
          {/* Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] mb-1">Phone</p>
              <p className="text-[#1F1F1A] font-medium">{request.phone_no || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] mb-1">Submitted</p>
              <p className="text-[#1F1F1A] font-medium">{new Date(request.created_at).toLocaleDateString("en-GB")}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] mb-1">Preferred Dates</p>
              <p className="text-[#1F1F1A] font-medium">{dates.length > 0 ? dates.join(", ") : "—"}</p>
            </div>
          </div>

          {/* Social Links */}
          {socials.length > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] mb-2">Social Media</p>
              <div className="flex flex-wrap gap-2">
                {socials.map(([key, url]) => {
                  const Icon = SOCIAL_ICONS[key] ?? Link2;
                  return (
                    <a
                      key={key}
                      href={url as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F7F4EA] rounded-lg text-xs font-bold text-[#26300D] hover:bg-[#E6DFC8] transition-colors"
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
              <p className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] mb-2">Performance Videos</p>
              <div className="space-y-3">
                {videos.map((url, i) => {
                  const isStorageUrl = url.includes("supabase.co/storage") || url.includes(".supabase.co");
                  return isStorageUrl ? (
                    <video
                      key={i}
                      src={url}
                      controls
                      className="w-full rounded-xl bg-black max-h-48 object-contain"
                      preload="metadata"
                    />
                  ) : (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs text-blue-600 hover:underline truncate"
                    >
                      <Link2 className="w-3.5 h-3.5 shrink-0" />
                      {url}
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notes */}
          {request.notes && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] mb-1">Notes from Applicant</p>
              <p className="text-sm text-[#1F1F1A] bg-[#F7F4EA] rounded-xl px-4 py-3">{request.notes}</p>
            </div>
          )}

          {/* Admin Notes + Actions */}
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
                  className="w-full bg-[#F7F4EA] border border-[#E6DFC8] rounded-xl px-4 py-3 text-sm text-[#1F1F1A] placeholder:text-[#5F624F]/50 focus:outline-none focus:border-[#26300D]/30 resize-none transition-all"
                />
              </div>

              {error && (
                <p className="text-red-500 text-xs font-medium">{error}</p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => handleAction("confirmed")}
                  disabled={isPending}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-black text-xs uppercase tracking-wider rounded-xl py-2.5 transition-all disabled:opacity-50"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> Confirm
                </button>
                <button
                  onClick={() => handleAction("rejected")}
                  disabled={isPending}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-100 hover:bg-red-200 text-red-700 font-black text-xs uppercase tracking-wider rounded-xl py-2.5 transition-all disabled:opacity-50"
                >
                  <XCircle className="w-3.5 h-3.5" /> Reject
                </button>
              </div>
            </div>
          )}

          {request.status !== "pending_review" && request.admin_notes && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] mb-1">Admin Notes</p>
              <p className="text-sm text-[#1F1F1A] bg-[#F7F4EA] rounded-xl px-4 py-3">{request.admin_notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
