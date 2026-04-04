import Link from "next/link";
import { ChevronRight, Clock, Grid2X2, Plus, Trophy, UserCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { UpcomingEvent, getEventType, getBookingsHref } from "../page";

export default function TonightCard({
  event,
  hostName,
  guests,
  capacity,
  capacityPercent,
}: {
  event: UpcomingEvent;
  hostName: string;
  guests: number;
  capacity: number;
  capacityPercent: number;
}) {
  const et = getEventType(event);
  const isQuiz = et?.sub_type?.toLowerCase().includes("quiz") || et?.type?.toLowerCase().includes("quiz");
  const bookingsHref = getBookingsHref(et);
  const confirmedTeams = isQuiz
    ? new Set(
        event.bookings
          .filter((b) => b.status === "confirmed")
          .map((b) => b.group_name)
      ).size
    : 0;

  return (
    <div className="bg-white border-2 border-[#E6DFC8] rounded-[2rem] overflow-hidden shadow-sm">
      <Link href={bookingsHref} className="block">
        <div className="bg-[#26300D] px-6 py-5 text-white flex items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="bg-[#FDCC4B] text-[#26300D] text-[9px] font-black px-2 py-0.5 rounded-sm uppercase tracking-widest">
              Tonight
            </span>
            <h3 className="text-xl font-black uppercase tracking-tight mt-2 leading-none truncate">
              {event.title ?? "Untitled Event"}
            </h3>
            <p className="text-sm text-white/60 mt-1.5 flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5" />
                {hostName}
              </span>
              {event.start_time && (
                <>
                  <span className="opacity-30">·</span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {event.start_time.substring(0, 5)}
                  </span>
                </>
              )}
            </p>
          </div>
          <div className="flex items-start gap-4 shrink-0">
            {isQuiz && (
              <>
                <div className="text-right">
                  <p className="text-3xl font-black tabular-nums text-[#FDCC4B] leading-none">
                    {confirmedTeams}
                  </p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/50 mt-1">
                    Teams
                  </p>
                </div>
                <div className="w-px self-stretch bg-white/10" />
              </>
            )}
            <div className="text-right">
              <p className="text-3xl font-black tabular-nums text-[#FDCC4B] leading-none">
                {guests}
              </p>
              <p className="text-[9px] font-black uppercase tracking-widest text-white/50 mt-1">
                Guests
              </p>
            </div>
          </div>
        </div>
      </Link>

      <div className="px-6 py-5 space-y-4">
        {capacity > 0 && (
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-[11px] font-black uppercase tracking-widest text-[#1F1F1A] flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#5F624F]" />
                Capacity
              </span>
              <span className="text-xs font-black text-[#5F624F]">
                {guests} / {capacity} — {capacityPercent}%
              </span>
            </div>
            <div className="h-2.5 w-full bg-[#F7F4EA] rounded-full overflow-hidden border border-[#E6DFC8]">
              <div
                className={cn(
                  "h-full transition-all duration-700 capacity-fill",
                  capacityPercent > 90 ? "bg-red-500" : "bg-[#26300D]"
                )}
                style={{ '--bar-width': `${capacityPercent}%` } as React.CSSProperties}
              />
            </div>
          </div>
        )}

        <div className={cn("grid gap-3", isQuiz ? "grid-cols-2" : "grid-cols-2")}>
          <Link
            href="/book/bingo"
            className="flex items-center justify-center gap-2 h-11 bg-[#F7F4EA] hover:bg-[#E6DFC8] border border-[#E6DFC8] rounded-xl transition-colors text-[10px] font-black uppercase tracking-widest text-[#1F1F1A]"
          >
            <Plus className="w-4 h-4" />
            Walk-in
          </Link>
          <Link
            href="/settings/tables"
            className="flex items-center justify-center gap-2 h-11 bg-[#F7F4EA] hover:bg-[#E6DFC8] border border-[#E6DFC8] rounded-xl transition-colors text-[10px] font-black uppercase tracking-widest text-[#1F1F1A]"
          >
            <Grid2X2 className="w-4 h-4" />
            Floorplan
          </Link>
        </div>
      </div>
    </div>
  );
}
