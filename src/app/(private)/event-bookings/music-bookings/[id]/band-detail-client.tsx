"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateBandStatus } from "../actions";
import type { BandStatus } from "../actions";
import type { BandRequest } from "../components/band-booking-card";
import { BAND_TRANSITIONS } from "../components/band-booking-card";
import {
  Loader2,
  Play,
  Link2,
  X,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export default function BandDetailClient({ request }: { request: BandRequest }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [adminNotes, setAdminNotes] = useState(request.admin_notes || "");
  const [error, setError] = useState<string | null>(null);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);

  const videos = (request.video_urls ?? []).filter(Boolean);

  function handleAction(status: BandStatus) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await updateBandStatus(request.id, status, adminNotes || undefined);
        // Booking into an occupied slot is refused server-side — stay put and say why
        // rather than navigating away as though it had gone through.
        if (result?.clashes?.length) {
          setError(
            `This slot clashes with ${result.clashes.map((c) => c.title).join(", ")} — pick another time.`
          );
          return;
        }
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
          <p className="mb-2 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
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
                  className="group relative flex h-20 w-28 shrink-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-xl bg-[#5C4033] transition-transform active:scale-95"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#C8956D]/40 bg-[#5C4033]/15 transition-colors group-hover:bg-[#C8956D]/30">
                    <Play className="h-3.5 w-3.5 translate-x-px fill-white text-white" />
                  </div>
                  <span className="font-black text-[9px] tracking-wide text-white/70 uppercase">
                    Video {i + 1}
                  </span>
                </button>
              ) : (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-20 w-28 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-[#E6DFC8] bg-white text-[#5F624F] transition-colors hover:bg-[#F7F4EA]"
                >
                  <Link2 className="h-4 w-4" />
                  <span className="font-black text-[9px] tracking-wide uppercase">
                    Link {i + 1}
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Action area — editable stages (declined is read-only). This quick view
          has no date picker, so "Mark Booked" is disabled until a slot exists;
          set the slot in the full sheet. */}
      {request.status !== "declined" && (
        <div className="space-y-3 border-t border-[#E6DFC8] pt-4">
          <div>
            <label className="mb-1.5 block font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
              Note to Applicant (optional)
            </label>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Add a message to include in the offer / outcome email…"
              rows={3}
              className="w-full resize-none rounded-2xl border border-[#E6DFC8] bg-white px-4 py-3 text-sm text-[#1F1F1A] transition-all placeholder:text-[#5F624F]/50 focus:border-[#5C4033]/30 focus:outline-none"
            />
          </div>

          {error && <p className="text-xs font-bold text-red-500">{error}</p>}

          <div className="flex flex-wrap gap-3">
            {(BAND_TRANSITIONS[request.status as BandStatus] ?? []).map((t) => {
              const needsSlot =
                t.next === "booked" &&
                (!request.selected_date || !request.selected_start_time || !request.selected_end_time);
              return (
                <button
                  key={t.next + t.label}
                  type="button"
                  onClick={() => handleAction(t.next)}
                  disabled={isPending || needsSlot}
                  title={needsSlot ? "Set a slot in the full view before booking" : undefined}
                  className={cn(
                    "flex min-w-28 flex-1 items-center justify-center gap-2 rounded-2xl py-4 font-black text-xs tracking-wider uppercase transition-all disabled:pointer-events-none disabled:opacity-50",
                    t.className
                  )}
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Video modal */}
      <Dialog open={!!activeVideo} onOpenChange={(v) => !v && setActiveVideo(null)}>
        <DialogContent className="w-full max-w-2xl overflow-hidden rounded-2xl border-0 bg-black p-0">
          <button
            title="Close"
            type="button"
            onClick={() => setActiveVideo(null)}
            className="absolute top-3 right-3 z-50 flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-white/20 text-white transition-colors hover:bg-white/30"
          >
            <X className="h-4 w-4" />
          </button>
          {activeVideo && (
            <video
              key={activeVideo}
              src={activeVideo}
              autoPlay
              controls
              className="max-h-[80vh] w-full object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
