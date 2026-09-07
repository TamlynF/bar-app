import { KineticHeadline } from "@/components/kinetic-headline";
import { MarketCta } from "@/components/market-cta";
import { PosterCard } from "@/components/poster-card";
import { TonightDeck } from "@/components/tonight-deck";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { parseDate, type SerializedEvent } from "@/lib/events-display";

export function HomeHero({
  tonightEvents,
  isTonight,
  doors = null,
}: {
  /* Still accepted so page.tsx needn't change; the strapline now lives in the marquee. */
  tagline?: string | null;
  accentWord?: string;
  tonightEvents: SerializedEvent[];
  isTonight: boolean;
  doors?: string | null;
}) {
  const primary = tonightEvents[0];

  return (
    <section
      className={cn(
        "relative flex flex-col gap-y-1 pt-4 pb-4 sm:pt-4",
        tonightEvents.length > 1 && "md:pb-16",
        primary &&
          "md:grid md:grid-cols-[1fr_minmax(20rem,0.85fr)] md:grid-rows-[1fr_auto] md:gap-x-5 md:gap-y-0 lg:gap-x-8",
      )}
    >
      {/* Phones: a small gold section header instead of the giant headline */}
      <div className="relative z-10 flex items-end justify-between gap-3 border-b border-white/10 pb-3 sm:hidden">
        <h2 className="m-0 inline-flex items-center gap-2 font-black text-2xl leading-none tracking-tighter text-gold uppercase">
          {isTonight && (
            <span
              className="ad-live-dot h-2 w-2 rounded-full bg-[#E6392E]"
              aria-hidden="true"
            />
          )}
          {isTonight ? "Tonight" : "Next up"}
        </h2>
        {primary && (
          <p className="text-right text-[11px] leading-tight text-ink-2 tabular-nums">
            {isTonight
              ? `${tonightEvents.length === 1 ? "1 act" : `${tonightEvents.length} acts`}${doors ? ` · doors ${doors}` : ""}`
              : format(parseDate(primary.date), "EEE d MMM")}
          </p>
        )}
      </div>

      {/* Tablet/desktop: the kinetic headline, top-aligned with the poster */}
      <div
        className={cn(
          "relative z-10 hidden sm:block",
          primary
            ? "min-w-0 md:col-start-1 md:row-start-1 md:self-start md:-mt-[0.08em]"
            : "mx-auto max-w-3xl text-center",
        )}
      >
        <KineticHeadline
          as="h2"
          lines={[
            { text: "What's on" },
            { text: isTonight ? "Tonight" : "Next up", accent: true },
          ]}
          align={primary ? "start" : "center"}
          className={cn(
            "gap-y-2 text-[clamp(2.25rem,10.5vw,3.5rem)] sm:gap-y-0 sm:text-7xl md:gap-y-4 md:text-[clamp(3rem,7.2vw,8.5rem)] lg:gap-y-5 lg:text-[clamp(3.5rem,5.4vw,6.25rem)]",
            !primary && "lg:text-8xl",
          )}
        />
      </div>

      {primary && (
        <div
          id="tonight"
          className="relative z-10 order-3 mt-4 scroll-mt-28 sm:mt-8 md:order-none md:col-start-2 md:row-span-2 md:row-start-1 md:mt-0 md:min-w-0"
        >
          {tonightEvents.length > 1 ? (
            <TonightDeck events={tonightEvents} isTonight={isTonight} />
          ) : (
            <PosterCard
              event={primary}
              isTonight={isTonight}
              className="animate-reveal mx-auto max-w-md [animation-delay:400ms] md:max-w-sm md:rotate-1 lg:max-w-[22rem] xl:max-w-sm"
            />
          )}
        </div>
      )}

      <div
        className={cn(
          "animate-reveal relative z-10 mt-6 hidden flex-wrap items-center gap-2.5 [animation-delay:850ms] empty:hidden sm:mt-6 sm:flex",
          primary
            ? "order-2 md:order-none md:col-start-1 md:row-start-2 md:self-end"
            : "justify-center",
        )}
      >
        <MarketCta />
      </div>
    </section>
  );
}
