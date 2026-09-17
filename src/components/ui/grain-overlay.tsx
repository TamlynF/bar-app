import { cn } from "@/lib/utils";

/* Film grain: a small SVG noise tile repeated over the area, kept under 5%
   opacity so it reads as texture rather than an effect. `fixed` covers the
   viewport; otherwise it fills its nearest positioned parent. */
export function GrainOverlay({ fixed = false, className }: { fixed?: boolean; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("ad-grain pointer-events-none z-[1] opacity-[0.045] mix-blend-overlay", fixed ? "fixed inset-0" : "absolute inset-0", className)}
    />
  );
}
