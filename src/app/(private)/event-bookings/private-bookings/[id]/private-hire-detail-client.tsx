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

  if (request.status !== "pending") return null;

  function handleAction(status: "confirmed" | "cancelled") {
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
    <div className="space-y-3 border-t border-[#D8D5C8] pt-4">
      <div>
        <label className="mb-1.5 block font-black text-[10px] tracking-wide text-[#5E6654] uppercase">
          Note to Enquirer (optional)
        </label>
        <textarea
          value={adminNotes}
          onChange={(e) => setAdminNotes(e.target.value)}
          placeholder="Add a message to include in the outcome email…"
          rows={3}
          className="w-full resize-none rounded-2xl border border-[#D8D5C8] bg-white px-4 py-3 text-sm text-[#20231A] transition-all placeholder:text-[#5E6654]/50 focus:border-[#34451F]/30 focus:outline-none"
        />
      </div>

      {error && <p className="text-xs font-bold text-red-500">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => handleAction("confirmed")}
          disabled={isPending}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-green-600 py-4 font-black text-xs tracking-wider text-white uppercase transition-all hover:bg-green-700 disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="h-4 w-4" />
          )}
          Confirm
        </button>
        <button
          type="button"
          onClick={() => handleAction("cancelled")}
          disabled={isPending}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 py-4 font-black text-xs tracking-wider text-red-700 uppercase transition-all hover:bg-red-100 disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          Cancel
        </button>
      </div>
    </div>
  );
}
