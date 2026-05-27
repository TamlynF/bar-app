"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateBandStatus } from "../actions";
import type { BandRequest } from "../components/band-booking-card";
import {
  CheckCircle,
  XCircle,
  Loader2,
  Play,
  Link2,
  X,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export default function BandDetailClient({ request }: { request: BandRequest }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [adminNotes, setAdminNotes] = useState(request.admin_notes || "");
  const [error, setError] = useState<string | null>(null);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);

  const videos = (request.video_urls ?? []).filter(Boolean);

  function handleAction(status: "approved" | "rejected") {
    setError(null);
    startTransition(async () => {
      try {
        await updateBandStatus(request.id, status, adminNotes || undefined);
        router.push("/event-bookings/music-bookings");
      } catch {
        setError("Failed to update. Please try again.");
      }
    });
  }

  return (
    <>
      {/* Performance Videos */}
      {videos.length > 0 && (
        <div>
          <p className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] mb-2">
            Performance Videos
          </p>
          <div className="flex flex-row flex-wrap gap-2">
            {videos.map((url, i) => {
              const isStorage =
                url.includes("supabase.co/storage") || url.includes(".supabase.co");
              return isStorage ? (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveVideo(url)}
                  className="relative h-20 w-28 shrink-0 rounded-xl overflow-hidden bg-[#5C4033] flex flex-col items-center justify-center gap-1 group active:scale-95 transition-transform"
                >
                  <div className="w-10 h-10 rounded-full bg-[#5C4033]/15 border border-[#C8956D]/40 flex items-center justify-center group-hover:bg-[#C8956D]/30 transition-colors">
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
                  className="h-20 w-28 shrink-0 rounded-xl flex flex-col items-center justify-center gap-1 bg-white border border-[#E6DFC8] text-[#5F624F] hover:bg-[#F7F4EA] transition-colors"
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

      {/* Action area — pending only */}
      {request.status === "pending_review" && (
        <div className="space-y-3 pt-4 border-t border-[#E6DFC8]">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wide text-[#5F624F] mb-1.5">
              Note to Applicant (optional)
            </label>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Add a message to include in the outcome email…"
              rows={3}
              className="w-full bg-white border border-[#E6DFC8] rounded-2xl px-4 py-3 text-sm text-[#1F1F1A] placeholder:text-[#5F624F]/50 focus:outline-none focus:border-[#5C4033]/30 resize-none transition-all"
            />
          </div>

          {error && <p className="text-red-500 text-xs font-bold">{error}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => handleAction("approved")}
              disabled={isPending}
              className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl py-4 transition-all disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              Approve
            </button>
            <button
              type="button"
              onClick={() => handleAction("rejected")}
              disabled={isPending}
              className="flex-1 flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-black text-xs uppercase tracking-wider rounded-2xl py-4 transition-all disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              Reject
            </button>
          </div>
        </div>
      )}

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
