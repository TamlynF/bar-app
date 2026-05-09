"use client";

import React, { useState, useTransition } from "react";
import { updatePrivateHireStatus } from "../actions";
import { ChevronDown, ChevronUp, CheckCircle, XCircle, Clock, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PrivateHireRequest {
  id: string;
  full_name: string;
  email: string;
  phone_no: string | null;
  guest_count: number;
  preferred_date: string | null;
  preferred_time: string | null;
  reason_for_hire: string;
  reason: string | null;
  additional_requirements: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

const STATUS_STYLES: Record<string, { label: string; class: string; icon: React.ElementType }> = {
  pending_review: { label: "Pending", class: "bg-amber-500/15 text-amber-600 border-amber-500/20", icon: Clock },
  confirmed: { label: "Confirmed", class: "bg-green-500/15 text-green-600 border-green-500/20", icon: CheckCircle },
  rejected: { label: "Rejected", class: "bg-red-500/15 text-red-600 border-red-500/20", icon: XCircle },
};

export function PrivateHireCard({ request }: { request: PrivateHireRequest }) {
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
        await updatePrivateHireStatus(request.id, status, adminNotes || undefined);
      } catch {
        setError("Failed to update. Please try again.");
      }
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E6DFC8] overflow-hidden">
      {/* Summary Row */}
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-[#F7F4EA]/60 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <p className="font-black text-sm text-[#1F1F1A] uppercase tracking-tight truncate">{request.full_name}</p>
          <p className="text-xs text-[#5F624F] truncate mt-0.5">{request.email}</p>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 shrink-0 text-xs text-[#5F624F]">
          <Users className="w-3.5 h-3.5" />
          {request.guest_count} guests
        </div>

        {request.preferred_date && (
          <p className="hidden md:block text-xs text-[#5F624F] shrink-0">{request.preferred_date}</p>
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] mb-1">Phone</p>
              <p className="text-[#1F1F1A] font-medium">{request.phone_no || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] mb-1">Guests</p>
              <p className="text-[#1F1F1A] font-medium">{request.guest_count}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] mb-1">Date</p>
              <p className="text-[#1F1F1A] font-medium">{request.preferred_date || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] mb-1">Time</p>
              <p className="text-[#1F1F1A] font-medium">{request.preferred_time || "—"}</p>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] mb-1">Reason for Hire</p>
            <p className="text-sm text-[#1F1F1A] bg-[#F7F4EA] rounded-xl px-4 py-3">{request.reason || request.reason_for_hire}</p>
          </div>

          {request.additional_requirements && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] mb-1">Additional Requirements</p>
              <p className="text-sm text-[#1F1F1A] bg-[#F7F4EA] rounded-xl px-4 py-3">{request.additional_requirements}</p>
            </div>
          )}

          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] mb-1">Submitted</p>
            <p className="text-sm text-[#1F1F1A]">{new Date(request.created_at).toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
          </div>

          {/* Actions */}
          {request.status === "pending_review" && (
            <div className="space-y-3 pt-2 border-t border-[#E6DFC8]">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-[#5F624F] mb-1.5">
                  Note to Enquirer (optional)
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add a message to include in the outcome email…"
                  rows={2}
                  className="w-full bg-[#F7F4EA] border border-[#E6DFC8] rounded-xl px-4 py-3 text-sm text-[#1F1F1A] placeholder:text-[#5F624F]/50 focus:outline-none focus:border-[#26300D]/30 resize-none transition-all"
                />
              </div>

              {error && <p className="text-red-500 text-xs font-medium">{error}</p>}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleAction("confirmed")}
                  disabled={isPending}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-black text-xs uppercase tracking-wider rounded-xl py-2.5 transition-all disabled:opacity-50"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> Confirm
                </button>
                <button
                  type="button"
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
