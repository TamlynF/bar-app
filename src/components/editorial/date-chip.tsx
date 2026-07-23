import { format } from "date-fns";
import { cn } from "@/lib/utils";

export function DateChip({ date, className }: { date: Date; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-hairline bg-canvas/80 px-2.5 py-1.5 text-center backdrop-blur-sm",
        className
      )}
    >
      <span className="block font-black text-[9px] tracking-widest text-stone-400 uppercase">
        {format(date, "EEE")}
      </span>
      <span className="block font-black text-xl leading-none text-ink tabular-nums">
        {format(date, "d")}
      </span>
      <span className="mt-0.5 block font-black text-[9px] tracking-widest text-stone-400 uppercase">
        {format(date, "MMM")}
      </span>
    </div>
  );
}
