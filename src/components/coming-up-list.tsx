import Link from "next/link";
import { differenceInCalendarDays, format, startOfDay } from "date-fns";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatGBP, parseDate, type SerializedEvent } from "@/lib/events-display";

const ROWS = 3;

function relativeLabel(date: Date, today: Date) {
  const diff = differenceInCalendarDays(startOfDay(date), startOfDay(today));
  if (diff === 0) return "Tonight";
  if (diff === 1) return "Tomorrow";
  if (diff < 7) return format(date, "EEE");
  return format(date, "EEE d MMM");
}

function entry(e: SerializedEvent) {
  if (e.isFullyBooked) return "Sold out";
  if (e.price != null && e.price > 0) return formatGBP(e.price);
  return "Free";
}

function ticketHref(e: SerializedEvent) {
  if (e.isFullyBooked) return null;
  if (e.externalLink) return e.externalLink;
  if (e.isBookable && e.price != null && e.price > 0 && e.bookingPageUrl) return e.bookingPageUrl;
  return null;
}

/* Phone-only agenda list for "Coming up": the next three events as 64px
   rows - date block, title, meta, genre tag, chevron - each row one link to
   the event page. Paid events get a sibling "Tickets" pill that goes straight
   to the ticket link without triggering the row. */
export function ComingUpList({
  events,
  today,
  className,
}: {
  events: SerializedEvent[];
  today: Date;
  className?: string;
}) {
  const todayStr = format(startOfDay(today), "yyyy-MM-dd");
  const upcoming = events.filter((e) => e.date > todayStr);
  const rows = upcoming.slice(0, ROWS);

  if (rows.length === 0) {
    const next = events[0];
    return (
      <p className={cn("px-1 py-4 text-sm text-ink-2", className)}>
        {next ? `Next event: ${format(parseDate(next.date), "EEE d MMM")} - ${next.title}` : "Nothing booked yet - check back soon."}
      </p>
    );
  }

  return (
    <ul className={cn("-mx-1", className)}>
      {rows.map((e, i) => {
        const date = parseDate(e.date);
        const tickets = ticketHref(e);
        const meta = [relativeLabel(date, today), e.startTimeLabel, entry(e)].filter(Boolean).join(" · ");
        return (
          <li
            key={e.id}
            className={cn("relative", i > 0 && "border-t border-white/10")}
            style={{ "--ev-c": e.color } as React.CSSProperties}
          >
            <Link
              href={`/whats-on/${e.id}`}
              aria-label={`${e.title}, ${meta}`}
              className={cn(
                "flex min-h-16 items-center gap-3 rounded-xl px-1 py-3 transition-transform duration-100 active:scale-[0.99] active:bg-white/5",
                tickets && "pr-24"
              )}
            >
              <span className="flex w-11 shrink-0 flex-col items-center leading-none">
                <span className={cn("font-black text-xl tabular-nums", i === 0 ? "text-gold" : "text-ink")}>
                  {format(date, "d")}
                </span>
                <span className="mt-1 font-black text-[10px] tracking-[0.18em] text-ink-2 uppercase">
                  {format(date, "EEE")}
                </span>
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate font-black text-sm tracking-tight text-ink uppercase">{e.title}</span>
                <span className="mt-0.5 block truncate text-[11px] text-ink-2 tabular-nums">{meta}</span>
              </span>

              {e.subType && (
                <span className="shrink-0 rounded-md bg-(--ev-c) px-1.5 py-0.5 font-black text-[9px] tracking-[0.14em] text-canvas uppercase">
                  {e.subType}
                </span>
              )}
              {!tickets && <ChevronRight className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />}
            </Link>

            {tickets && (
              <a
                href={tickets}
                target={tickets.startsWith("http") ? "_blank" : undefined}
                rel={tickets.startsWith("http") ? "noopener noreferrer" : undefined}
                aria-label={`Tickets for ${e.title}`}
                className="absolute top-1/2 right-1 -translate-y-1/2 rounded-lg bg-gold px-3 py-2 font-black text-[10px] tracking-[0.14em] text-on-gold uppercase shadow-[0_2px_0_#a8801c] active:translate-y-[calc(-50%+2px)] active:shadow-none"
              >
                Tickets
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}
