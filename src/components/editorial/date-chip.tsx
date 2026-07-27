import { format } from "date-fns";
import { cn } from "@/lib/utils";

export function DateChip({
  date,
  tone = "glass",
  className,
}: {
  date: Date;
  tone?: "glass" | "gold";
  className?: string;
}) {
  const gold = tone === "gold";

  return (
    <div
      className={cn(
        "rounded-xl px-2.5 py-1.5 text-center",
        gold
          ? "bg-gold shadow-lg shadow-black/40"
          : "border border-hairline bg-canvas/80 backdrop-blur-sm",
        className
      )}
    >
      <span
        className={cn(
          "block font-black text-[9px] tracking-widest uppercase",
          gold ? "text-on-gold/70" : "text-stone-400"
        )}
      >
        {format(date, "EEE")}
      </span>
      <span
        className={cn(
          "block font-black leading-none tabular-nums",
          gold ? "text-2xl text-on-gold" : "text-xl text-ink"
        )}
      >
        {format(date, "d")}
      </span>
      <span
        className={cn(
          "mt-0.5 block font-black text-[9px] tracking-widest uppercase",
          gold ? "text-on-gold/70" : "text-stone-400"
        )}
      >
        {format(date, "MMM")}
      </span>
    </div>
  );
}
