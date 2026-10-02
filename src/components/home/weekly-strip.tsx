import Link from "next/link";
import { ArrowCta } from "@/components/ui/arrow-cta";
import { WEEKLY_LISTINGS, type WeeklyListing } from "@/lib/venue-offerings";
import { formatClock, toMinutes, type OpeningHours } from "@/lib/opening-hours";
import { WEEKLY_NIGHTS } from "@/lib/weekly-nights";
import { cn } from "@/lib/utils";

const LISTING_COLOR: Record<WeeklyListing["key"], string> = {
  quiz: "text-[#5ED6F0]",
  karaoke: "text-[#FF8A80]",
  live: "text-gold",
};

/* The three nights that happen every week without fail. They are not
   events in the schedule, so they never move or sell out; the quiz tile
   carries the one booking link. */
function closingTime(listing: WeeklyListing, hours: OpeningHours | null | undefined) {
  const close = toMinutes(hours?.[listing.dayKey]?.close);
  return close == null ? null : formatClock(close);
}

export function WeeklyStrip({ hours, className }: { hours?: OpeningHours | null; className?: string }) {
  return (
    <section aria-labelledby="weekly-heading" className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2
          id="weekly-heading"
          className="font-black text-h2 tracking-tighter text-ink uppercase sm:font-semibold sm:text-eyebrow sm:tracking-normal sm:text-gold sm:normal-case"
        >
          <span className="sm:hidden">Every week</span>
          <span className="hidden sm:inline">What’s on</span>
        </h2>
      </div>
      <ul className="grid grid-cols-[auto_1fr_auto_auto_auto] divide-y divide-hairline border-y border-hairline sm:hidden">
        {WEEKLY_LISTINGS.map((listing) => (
          <li key={listing.key} className="col-span-5 grid grid-cols-subgrid">
            <Link
              href={listing.href}
              className="group col-span-5 grid min-h-14 grid-cols-subgrid items-center gap-x-1 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              <span className="pr-2 font-pirata text-h2 leading-none text-ink">{listing.day}</span>
              <span
                className={cn(
                  "pr-1 font-pirata text-h2 leading-none transition-opacity group-hover:opacity-80",
                  LISTING_COLOR[listing.key]
                )}
              >
                {listing.title}
              </span>
              <span className="text-right text-meta whitespace-nowrap text-ink-2 tabular-nums">{listing.time}</span>
              <span className="text-meta text-ink-2" aria-hidden={!closingTime(listing, hours)}>
                {closingTime(listing, hours) ? "–" : ""}
              </span>
              <span className="text-right text-meta whitespace-nowrap text-ink-2 tabular-nums">
                {closingTime(listing, hours)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <ol className="hidden grid-cols-3 gap-2 sm:grid lg:hidden">
        {WEEKLY_NIGHTS.map((night) => {
          const lead = night.bookHref != null;
          return (
            <li
              key={night.key}
              className={cn("flex flex-col gap-1.5 border p-2.5", lead ? "border-gold bg-canvas-2" : "border-hairline")}
            >
              <span className="font-black text-h3 leading-none tracking-tighter text-gold uppercase">{night.dayShort}</span>
              <span className="font-black text-pill leading-tight tracking-tight text-ink uppercase">{night.title}</span>
              <span className="text-pill leading-snug text-ink-2">{night.metaShort}</span>
              {lead && night.bookHref ? (
                <ArrowCta href={night.bookHref} variant="gold" size="sm" className="mt-auto w-full rounded-none">
                  Book
                </ArrowCta>
              ) : (
                <span className="mt-auto flex h-8 items-center text-pill font-bold tracking-wide text-ink-2 uppercase">Walk in</span>
              )}
            </li>
          );
        })}
      </ol>
      <ol className="hidden grid-cols-3 gap-4 lg:grid">
        {WEEKLY_NIGHTS.map((night) => {
          const lead = night.bookHref != null;
          return (
            <li
              key={night.key}
              className={cn(
                "flex flex-col gap-2 border p-3 lg:gap-3 lg:p-5",
                lead ? "border-gold bg-canvas-2" : "border-hairline"
              )}
            >
              <span className="font-black text-h3 leading-none tracking-tighter text-gold uppercase">
                <span className="lg:hidden">{night.dayShort}</span>
                <span className="hidden lg:inline">{night.day}</span>
              </span>
              <div className="flex flex-1 flex-col gap-1">
                <h3 className="font-black text-btn leading-tight tracking-tight text-ink uppercase lg:text-h3">{night.title}</h3>
                <p className="text-pill leading-snug text-ink-2 lg:text-meta">{night.meta}</p>
              </div>
              {lead && night.bookHref ? (
                <ArrowCta href={night.bookHref} variant="gold" size="sm" className="w-full rounded-none">
                  <span className="lg:hidden">Book</span>
                  <span className="hidden lg:inline">{night.bookLabel}</span>
                </ArrowCta>
              ) : (
                <span className="flex h-8 items-center text-pill font-bold tracking-wide text-ink-2 uppercase">Walk in</span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
