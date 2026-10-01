"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { DetailCard } from "@/components/admin";
import { allowQuizQuestionAgainAction, type QuizExclusion } from "./actions";

export default function NeverShownCard({ exclusions }: { exclusions: QuizExclusion[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  const allowAgain = (exclusion: QuizExclusion) => {
    setPendingId(exclusion.id);
    startTransition(async () => {
      const result = await allowQuizQuestionAgainAction(exclusion.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("It can be suggested again.");
        router.refresh();
      }
      setPendingId(null);
    });
  };

  return (
    <DetailCard>
      <div className="flex items-center justify-between gap-3 border-b border-admin-line px-4 py-2.5 sm:px-5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-wide text-admin-muted opacity-70">
            Never shown again
          </p>
          <p className="truncate text-sm font-semibold text-admin-ink">
            {exclusions.length === 0
              ? "Nothing turned down yet"
              : `${exclusions.length} turned down in the round sheet`}
          </p>
        </div>
        <EyeOff className="h-4 w-4 shrink-0 text-admin-muted" />
      </div>

      {exclusions.length === 0 ? (
        <p className="px-4 py-3 text-[13px] text-admin-muted sm:px-5">
          Questions left unpicked or swapped out when a round is added land here, and the
          generator won&apos;t suggest them for this category again.
        </p>
      ) : (
        <ul className="max-h-96 divide-y divide-admin-line overflow-y-auto">
          {exclusions.map((exclusion) => (
            <li key={exclusion.id} className="flex items-center gap-3 px-4 py-2 sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-snug font-semibold text-admin-ink">
                  {exclusion.content_text}
                </p>
                <p className="mt-0.5 text-[11px] text-admin-muted">
                  {format(new Date(exclusion.created_at), "d MMM yyyy")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => allowAgain(exclusion)}
                disabled={pendingId !== null}
                title={`Let the generator suggest "${exclusion.content_text}" again`}
                className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-admin-line bg-admin-card px-3 text-[13px] font-semibold text-admin-muted transition-colors hover:bg-admin-surface hover:text-admin-ink disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-9"
              >
                {pendingId === exclusion.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
                Allow again
              </button>
            </li>
          ))}
        </ul>
      )}
    </DetailCard>
  );
}
