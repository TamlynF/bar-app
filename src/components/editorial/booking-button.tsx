import { Mic2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SerializedEvent } from "@/lib/events-display";

const base =
  "flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-black uppercase tracking-wide whitespace-nowrap";

/* Pressable "3D" treatment: a hard flank under the button that collapses on
   press, so it reads as a physical key rather than a flat pill. */
const pressable =
  "translate-y-0 transition-[transform,box-shadow,background-color] duration-150 active:translate-y-[3px] active:shadow-none";

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
          pressable,
          "bg-[#B8451A] text-white shadow-[0_3px_0_#6f2a0f] hover:bg-[#A33D16]"
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
          pressable,
          "bg-gold text-on-gold shadow-[0_3px_0_#a8801c] hover:bg-[#ffd76a]"
        )}
      >
        {seated ? "Book table" : "Get tickets"}
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
