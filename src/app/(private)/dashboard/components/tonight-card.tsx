import Link from "next/link";
import { ListItem } from "../page";

export default function TonightCard({
  event,
  guests,
  capacity,
  capacityPercent,
}: {
  event: ListItem;
  guests: number;
  capacity: number;
  capacityPercent: number;
}) {
  const start = event.startTime ? event.startTime.substring(0, 5) : null;
  const end = event.endTime ? event.endTime.substring(0, 5) : null;

  const meta = [
    event.hostName ? `Host ${event.hostName}` : null,
    capacity > 0 ? `${guests}/${capacity} booked` : `${guests} booked`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="bg-white border border-[#E6DFC8] rounded-2xl p-3.5 flex items-center gap-3 shadow-sm">
      {/* Time block */}
      <div className="w-12 h-12 rounded-xl bg-[#5C4033] flex flex-col items-center justify-center shrink-0 leading-none text-white">
        <span className="text-xs font-black tracking-wide tabular-nums">{start ?? "TBC"}</span>
        {end && <span className="text-[9px] font-bold text-white/60 mt-0.5 tabular-nums">{end}</span>}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-black uppercase tracking-tight text-[#1F1F1A] truncate">
          {event.title}
        </div>
        <div className="text-[11px] font-semibold text-[#5F624F] mt-0.5 truncate">{meta}</div>
        {capacity > 0 && (
          <div className="h-2 mt-2 rounded-full bg-[#F7F4EA] border border-[#E6DFC8] overflow-hidden">
            <div
              className="h-full bg-[#5C4033] rounded-full w-(--w)"
              style={{ "--w": `${capacityPercent}%` } as React.CSSProperties}
            />
          </div>
        )}
      </div>

      {/* Open */}
      <Link
        href={event.href}
        className="shrink-0 inline-flex items-center justify-center h-10 px-4 rounded-xl bg-[#5C4033] hover:bg-[#5C4033]/85 text-white text-[11px] font-black uppercase tracking-wide transition-colors"
      >
        Open
      </Link>
    </div>
  );
}
