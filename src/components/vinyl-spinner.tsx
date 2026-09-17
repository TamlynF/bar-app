import { cn } from "@/lib/utils";

/* A spinning record: grooves from a repeating radial gradient, gold label,
   spindle hole. Used as the public loading indicator. */
export function VinylSpinner({ className, label = "Loading" }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-label={label} className={cn("relative inline-block h-16 w-16", className)}>
      <span
        aria-hidden="true"
        className="ad-spin absolute inset-0 rounded-full bg-[repeating-radial-gradient(circle,#0e0e0c_0_1.5px,#1f1f1b_1.5px_3.5px)] shadow-[0_10px_24px_rgba(0,0,0,0.6),inset_0_0_0_1px_rgba(255,255,255,0.08)]"
      >
        <span className="absolute inset-[34%] rounded-full bg-gold" />
        <span className="absolute inset-[46%] rounded-full bg-canvas" />
        <span className="absolute top-[12%] left-1/2 h-[3%] w-[14%] -translate-x-1/2 rounded-full bg-white/10" />
      </span>
    </span>
  );
}
