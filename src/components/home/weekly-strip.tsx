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

const STUB =
  "group flex min-w-0 flex-1 flex-col items-center gap-1.5 px-2 pt-3 pb-2.5 text-center focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold";

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
      <span className="text-pill font-black tracking-wide text-ink-2 uppercase">{listing.day}</span>
      <span className={cn("font-pirata text-[26px] leading-[0.95]", listing.accentText)}>{listing.shortTitle}</span>
      <span className="flex flex-col items-center gap-0.5 tabular-nums">
        <span className="text-[15px] leading-none font-bold text-ink">{listing.time}</span>
        {close && <span className="text-xs leading-none text-ink-2">till {close}</span>}
      </span>
      <span
        className={cn(
          "mt-auto flex h-9 w-full items-center justify-center gap-1 rounded-lg text-[13px] font-extrabold text-on-gold transition-transform group-active:scale-95",
          listing.accentBg
        )}
      >
        {action}
        <span aria-hidden="true">{external ? "↗" : "→"}</span>
      </span>
    </>
  );
}

export function WeeklyStrip({
  hours,
  karaokeUrl,
  className,
}: {
  hours?: OpeningHours | null;
  karaokeUrl?: string | null;
  className?: string;
}) {
  return (
    <section aria-labelledby="weekly-heading" className={cn("flex flex-col gap-2 sm:gap-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2
          id="weekly-heading"
          className="font-black text-sm tracking-[0.08em] text-ink-2 uppercase max-sm:leading-none sm:font-semibold sm:text-eyebrow sm:tracking-normal sm:text-gold sm:normal-case"
        >
          <span className="sm:hidden">Every week</span>
          <span className="hidden sm:inline">What’s on</span>
        </h2>
      </div>
      <ul className="grid grid-cols-3 overflow-hidden rounded-2xl border border-gold bg-white/8 sm:hidden">
        {WEEKLY_LISTINGS.map((listing, i) => {
          const sing = listing.key === "karaoke" && karaokeUrl ? karaokeUrl : null;
          const close = closingTime(listing, hours);
          return (
            <li
              key={listing.key}
              className={cn("flex min-w-0", i > 0 && "border-l border-dashed border-white/20")}
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
                  href={listing.href}
                  aria-label={`${listing.title}, ${listing.day} ${listing.time}: ${listing.key === "quiz" ? "book a team" : "see what's on"}`}
                  className={STUB}
                >
                  <StubContent listing={listing} close={close} action={listing.actionLabel} />
                </Link>
              )}
            </li>
          );
        })}
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
