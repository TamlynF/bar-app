import Link from "next/link";
import { ArrowCta } from "@/components/ui/arrow-cta";
import { WEEKLY_LISTINGS, type WeeklyListing } from "@/lib/venue-offerings";
import { formatClock, toMinutes, type OpeningHours } from "@/lib/opening-hours";
import { WEEKLY_NIGHTS } from "@/lib/weekly-nights";
import { cn } from "@/lib/utils";

/* The three nights that happen every week without fail. They are not
   events in the schedule, so they never move or sell out; the quiz tile
   carries the one booking link. */
function closingTime(listing: WeeklyListing, hours: OpeningHours | null | undefined) {
  const close = toMinutes(hours?.[listing.dayKey]?.close);
  return close == null ? null : formatClock(close);
}

/* Phone cards take the mockup's accents rather than the listing's own
   classes so the glow, bulb and button all share one --acc colour. */
const CARD_ACCENT: Record<WeeklyListing["key"], string> = {
  quiz: "#6FD3C4",
  karaoke: "#FD632B",
  live: "#FDCC4B",
};

const STUB =
  "ad-regular relative flex min-h-40 w-full flex-col items-center gap-1.75 overflow-hidden rounded-[14px] px-2 pt-3.5 pb-2.5 text-center focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold";

function StubContent({
  listing,
  close,
  action,
  external = false,
}: {
  listing: WeeklyListing;
  close: string | null;
  action: string;
  external?: boolean;
}) {
  return (
    <>
      <span className="mt-1 text-[10px] leading-none font-black tracking-[0.16em] text-[var(--acc)] uppercase">
        {listing.day}
      </span>
      <span className="font-pirata text-[30px] leading-[0.95] text-ink [text-shadow:0_2px_0_rgb(0_0_0/0.5)]">
        {listing.shortTitle}
      </span>
      <span className="flex flex-col items-center gap-1 tabular-nums">
        <span className="text-[15px] leading-none font-bold text-ink">{listing.time}</span>
        {close && <span className="text-xs leading-none text-ink-2">till {close}</span>}
      </span>
      <span className="ad-regular-perf mt-0.5" aria-hidden="true" />
      <span className="ad-regular-btn mt-auto flex h-9.5 w-full items-center justify-center gap-1 rounded-[10px] text-[13px] leading-none font-extrabold text-on-gold">
        {action}
        <span aria-hidden="true">{external ? "↗" : "→"}</span>
      </span>
    </>
  );
}

export function WeeklyStrip({
  hours,
  karaokeUrl,
  quizUrl,
  className,
}: {
  hours?: OpeningHours | null;
  karaokeUrl?: string | null;
  quizUrl?: string | null;
  className?: string;
}) {
  return (
    <section aria-labelledby="weekly-heading" className={cn("flex flex-col gap-2 sm:gap-3", className)}>
      <div className="flex items-center justify-between gap-3 max-sm:mb-1.5">
        <h2 id="weekly-heading" className="sm:font-semibold sm:text-eyebrow sm:text-gold">
          <span className="mb-1.5 block text-[10px] leading-none font-bold tracking-[0.18em] text-gold uppercase sm:hidden">
            Every week
          </span>
          <span className="block font-display text-[26px] leading-none tracking-[0.02em] text-ink uppercase sm:hidden">
            The regulars
          </span>
          <span className="hidden sm:inline">What’s on</span>
        </h2>
      </div>
      <ul className="grid grid-cols-3 gap-2.25 sm:hidden">
        {WEEKLY_LISTINGS.map((listing) => {
          const sing = listing.key === "karaoke" && karaokeUrl ? karaokeUrl : null;
          const book = listing.key === "quiz" && quizUrl ? quizUrl : null;
          const close = closingTime(listing, hours);
          return (
            <li
              key={listing.key}
              className="flex min-w-0"
              style={{ "--acc": CARD_ACCENT[listing.key] } as React.CSSProperties}
            >
              {sing ? (
                <a
                  href={sing}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${listing.title}, ${listing.day} ${listing.time}: request a song on Singa`}
                  className={STUB}
                >
                  <StubContent listing={listing} close={close} action="Sing" external />
                </a>
              ) : (
                <Link
                  href={book ?? listing.href}
                  aria-label={`${listing.title}, ${listing.day} ${listing.time}: ${book ? "book a team" : "see what's on"}`}
                  className={STUB}
                >
                  <StubContent listing={listing} close={close} action={book ? listing.actionLabel : "Info"} />
                </Link>
              )}
            </li>
          );
        })}
      </ul>
      <ol className="hidden grid-cols-3 gap-2 sm:grid lg:hidden">
        {WEEKLY_NIGHTS.map((night) => {
          const bookHref = night.bookable ? quizUrl ?? null : null;
          const lead = bookHref != null;
          return (
            <li
              key={night.key}
              className={cn("flex flex-col gap-1.5 border p-2.5", lead ? "border-gold bg-canvas-2" : "border-hairline")}
            >
              <span className="font-black text-h3 leading-none tracking-tighter text-gold uppercase">{night.dayShort}</span>
              <span className="font-black text-pill leading-tight tracking-tight text-ink uppercase">{night.title}</span>
              <span className="text-pill leading-snug text-ink-2">{night.metaShort}</span>
              {bookHref ? (
                <ArrowCta href={bookHref} variant="gold" size="sm" className="mt-auto w-full rounded-none">
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
          const bookHref = night.bookable ? quizUrl ?? null : null;
          const lead = bookHref != null;
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
              {bookHref ? (
                <ArrowCta href={bookHref} variant="gold" size="sm" className="w-full rounded-none">
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
