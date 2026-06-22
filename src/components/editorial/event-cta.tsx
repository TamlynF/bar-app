import { CalendarDays, Mic2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SerializedEvent } from "@/lib/events-display";

/**
 * The single source of truth for an event's call-to-action on the public site:
 * Sold Out → Sing (karaoke) → Not Started (karaoke pre-open) → Book → Walk in.
 * Mirrors the status logic in NextEventHero / EventCard so every surface agrees.
 *
 * `size="lg"` renders the full-width pill used in the home hero's "on tonight"
 * card; `size="sm"` (default) renders the compact pill used in schedule rows.
 */
export function EventCta({
  event,
  size = "sm",
}: {
  event: SerializedEvent;
  size?: "sm" | "lg";
}) {
  const lg = size === "lg";
  const icon = lg ? "w-4 h-4" : "w-3.5 h-3.5";
  const pill = lg
    ? "inline-flex items-center justify-center gap-2 w-full h-12 px-6 rounded-xl text-sm font-black uppercase tracking-wide active:scale-95 transition-all"
    : "shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[10px] font-black uppercase tracking-wide active:scale-95 transition-all";

  if (event.isFullyBooked) {
    return (
      <span
        className={cn(
          "shrink-0 inline-flex items-center justify-center font-black uppercase tracking-widest text-red-400 bg-red-500/10 border border-red-500/20 rounded-full",
          lg ? "w-full h-12 text-xs" : "h-9 px-3.5 text-[10px]"
        )}
      >
        Sold Out
      </span>
    );
  }

  if (event.isKaraoke && event.karaokeRequestUrl) {
    return (
      <a
        href={event.karaokeRequestUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(pill, "text-white bg-[#FF6B35] hover:bg-[#FF6B35]/90")}
        aria-label="Request a song to sing on Singa"
      >
        <Mic2 className={cn(icon, "shrink-0")} aria-hidden="true" />
        Sing
      </a>
    );
  }

  if (event.isKaraoke && !event.karaokeRequestUrl) {
    return (
      <span
        className={cn(
          pill,
          "bg-white/5 text-stone-500 border border-white/10 cursor-default"
        )}
        title="Karaoke night hasn't started yet"
      >
        <Mic2 className={cn(icon, "shrink-0")} aria-hidden="true" />
        Soon
      </span>
    );
  }

  if (event.isBookable && event.bookingPageUrl) {
    return (
      <a
        href={event.bookingPageUrl}
        className={cn(pill, "text-[#1a2008] bg-[#FDCC4B] hover:bg-[#FDCC4B]/90")}
        aria-label={`Book ${event.title}`}
      >
        <CalendarDays className={cn(icon, "shrink-0")} aria-hidden="true" />
        Book
      </a>
    );
  }

  // No booking action — walk-in. Keeps the row/card rhythm without implying a flow.
  return (
    <span
      className={cn(
        pill,
        "bg-white/5 text-stone-300 border border-white/10 cursor-default"
      )}
    >
      Walk in
      <ArrowRight className={cn(icon, "shrink-0")} aria-hidden="true" />
    </span>
  );
}
