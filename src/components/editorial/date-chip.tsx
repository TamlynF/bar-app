import { format } from "date-fns";
import { cn } from "@/lib/utils";

const toneStyles = {
  glass: {
    shell: "border border-hairline bg-canvas/80 backdrop-blur-sm",
    label: "text-stone-400",
    day: "text-xl text-ink",
  },
  gold: {
    shell: "bg-gold shadow-lg shadow-black/40",
    label: "text-on-gold/70",
    day: "text-2xl text-on-gold",
  },
  dark: {
    shell: "border border-hairline bg-canvas/90 shadow-lg shadow-black/40 backdrop-blur-sm",
    label: "text-gold/75",
    day: "text-2xl text-ink",
  },
} as const;

export function DateChip({
  date,
  tone = "glass",
  className,
}: {
  date: Date;
  tone?: keyof typeof toneStyles;
  className?: string;
}) {
  const styles = toneStyles[tone];

  return (
    <div className={cn("rounded-xl px-2.5 py-1.5 text-center", styles.shell, className)}>
      <span
        className={cn("block font-black text-[9px] tracking-widest uppercase", styles.label)}
      >
        {format(date, "EEE")}
      </span>
      <span className={cn("block font-black leading-none tabular-nums", styles.day)}>
        {format(date, "d")}
      </span>
      <span
        className={cn("mt-0.5 block font-black text-[9px] tracking-widest uppercase", styles.label)}
      >
        {format(date, "MMM")}
      </span>
    </div>
  );
}
