import { ArrowCta } from "@/components/ui/arrow-cta";
import { WEEKLY_NIGHTS } from "@/lib/weekly-nights";
import { cn } from "@/lib/utils";

/* The three nights that happen every week without fail. They are not
   events in the schedule, so they never move or sell out; the quiz tile
   carries the one booking link. */
export function WeeklyStrip({ className }: { className?: string }) {
  return (
    <section aria-labelledby="weekly-heading" className={cn("flex flex-col gap-3", className)}>
      <h2
        id="weekly-heading"
        className="font-black text-h2 tracking-tighter text-balance text-ink uppercase sm:font-semibold sm:text-eyebrow sm:tracking-normal sm:text-gold sm:normal-case"
      >
        What’s on
      </h2>
      <ol className="grid grid-cols-3 gap-2 lg:hidden">
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
