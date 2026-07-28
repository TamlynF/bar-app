import { ArrowRight, Mic2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SerializedEvent } from "@/lib/events-display";

const base =
  "flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-black uppercase tracking-wide";

export function BookingButton({ event }: { event: SerializedEvent }) {
  if (event.isBookable && event.isFullyBooked) {
    return (
      <span
        aria-disabled="true"
        className={cn(
          base,
          "pointer-events-none cursor-not-allowed border border-red-500/20 bg-red-500/10 text-red-400/80"
        )}
      >
        Sold out
      </span>
    );
  }

  if (event.isKaraoke && event.karaokeRequestUrl) {
    return (
      <a
        href={event.karaokeRequestUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Request a song for ${event.title} on Singa`}
        className={cn(
          base,
          "bg-[#FF6B35] text-white transition-all hover:bg-[#FF6B35]/90 active:scale-[0.98]"
        )}
      >
        <Mic2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        Sing tonight
      </a>
    );
  }

  if (event.isBookable && event.bookingPageUrl) {
    const seated = event.requiresSeating;
    return (
      <a
        href={event.bookingPageUrl}
        aria-label={`${seated ? "Book a table for" : "Get tickets for"} ${event.title}`}
        className={cn(
          base,
          "group/cta bg-gold text-on-gold transition-all hover:bg-gold/90 active:scale-[0.98]"
        )}
      >
        {seated ? "Book a table" : "Get tickets"}
        <ArrowRight
          className="h-4 w-4 shrink-0 transition-transform group-hover/cta:translate-x-0.5"
          aria-hidden="true"
        />
      </a>
    );
  }

  return (
    <span
      className={cn(
        base,
        "pointer-events-none cursor-default gap-2 border border-dashed border-gold/30 bg-gold/5 text-[11px] tracking-widest text-gold/80"
      )}
    >
      Just walk in
    </span>
  );
}
