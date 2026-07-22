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
    <div className="flex items-center gap-3 rounded-2xl border border-[#E6DFC8] bg-white p-3.5 shadow-sm">
      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-[#5C4033] leading-none text-white">
        <span className="font-black text-xs tracking-wide tabular-nums">{start ?? "TBC"}</span>
        {end && <span className="mt-0.5 text-[9px] font-bold text-white/60 tabular-nums">{end}</span>}
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate font-black text-[15px] tracking-tight text-[#1F1F1A] uppercase">
          {event.title}
        </div>
        <div className="mt-0.5 truncate text-[11px] font-semibold text-[#5F624F]">{meta}</div>
        {capacity > 0 && (
          <div className="mt-2 h-2 overflow-hidden rounded-full border border-[#E6DFC8] bg-[#F7F4EA]">
            <div
              className="h-full w-(--w) rounded-full bg-[#5C4033]"
              style={{ "--w": `${capacityPercent}%` } as React.CSSProperties}
            />
          </div>
        )}
      </div>

      <Link
        href={event.href}
        className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-[#5C4033] px-4 font-black text-[11px] tracking-wide text-white uppercase transition-colors hover:bg-[#5C4033]/85"
      >
        Open
      </Link>
    </div>
  );
}
