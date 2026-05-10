"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePrivateHireStatus } from "../actions";
import type { PrivateHireRequest } from "../components/private-hire-card";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function PrivateHireDetailClient({
  request,
}: {
  request: PrivateHireRequest;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [adminNotes, setAdminNotes] = useState(request.admin_notes || "");
  const [error, setError] = useState<string | null>(null);

  if (request.status !== "pending_review") return null;

  function handleAction(status: "confirmed" | "rejected") {
    setError(null);
    startTransition(async () => {
      try {
        await updatePrivateHireStatus(request.id, status, adminNotes || undefined);
        router.push("/event-bookings/private-bookings");
      } catch {
        setError("Failed to update. Please try again.");
      }
    });
  }

  return (
    <div className="space-y-3 pt-4 border-t border-[#E6DFC8]">
      <div>
        <label className="block text-[10px] font-black uppercase tracking-wide text-[#5F624F] mb-1.5">
          Note to Enquirer (optional)
        </label>
        <textarea
          value={adminNotes}
          onChange={(e) => setAdminNotes(e.target.value)}
          placeholder="Add a message to include in the outcome email…"
          rows={3}
          className="w-full bg-white border border-[#E6DFC8] rounded-2xl px-4 py-3 text-sm text-[#1F1F1A] placeholder:text-[#5F624F]/50 focus:outline-none focus:border-[#26300D]/30 resize-none transition-all"
        />
      </div>

      {error && <p className="text-red-500 text-xs font-bold">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => handleAction("confirmed")}
          disabled={isPending}
          className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl py-4 transition-all disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle className="w-4 h-4" />
          )}
          Confirm
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
  );
}
