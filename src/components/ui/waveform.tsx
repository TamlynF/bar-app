import { cn } from "@/lib/utils";

const HEIGHTS = [0.35, 0.7, 1, 0.55, 0.85, 0.45, 0.9, 0.6, 0.75, 0.4, 0.95, 0.5];

/* A small live-audio waveform: a row of bars that breathe in height and
   opacity, each on its own phase. Decorative only. `active` runs the
   animation; otherwise the bars sit still at their resting heights. */
export function Waveform({
  bars = 7,
  active = true,
  className,
  barClassName,
}: {
  bars?: number;
  active?: boolean;
  className?: string;
  barClassName?: string;
}) {
  return (
    <span aria-hidden="true" className={cn("inline-flex h-3.5 items-end gap-[2px]", className)}>
      {Array.from({ length: bars }, (_, i) => (
        <span
          key={i}
          className={cn("ad-wave-bar w-[2px] rounded-full bg-current", active && "ad-wave-live", barClassName)}
          style={
            {
              "--wave-h": HEIGHTS[i % HEIGHTS.length],
              "--wave-delay": `${(i * 137) % 900}ms`,
              "--wave-dur": `${900 + ((i * 211) % 500)}ms`,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}
