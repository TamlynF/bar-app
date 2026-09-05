import { Fragment } from "react";
import { KineticHeadline } from "@/components/kinetic-headline";
import { MarketCta } from "@/components/market-cta";
import { PosterCard } from "@/components/poster-card";
import { TonightDeck } from "@/components/tonight-deck";
import { cn } from "@/lib/utils";
import type { SerializedEvent } from "@/lib/events-display";

function offerItems(tagline: string | null) {
  const items = (tagline ?? "")
    .replace(/\.$/, "")
    .split(/,|·/)
    .map((part) => part.trim())
    .filter(Boolean);
  return items.length > 0 ? items : ["Live music & late nights"];
}

function EyebrowDot() {
  return (
    <span className="shrink-0 text-gold/80" aria-hidden="true">
      ·
    </span>
  );
}

function OfferEyebrow({
  tagline,
  accentWord,
  centered,
}: {
  tagline: string | null;
  accentWord?: string;
  centered: boolean;
}) {
  const items = offerItems(tagline);
  const accent = accentWord?.toLowerCase();

  return (
    <p
      className={cn(
        "animate-reveal mb-4 flex w-full max-w-full items-center gap-x-1 rounded-full md:mb-3 border border-white/15 bg-white/6 px-3 py-2 font-black text-[10px] leading-tight tracking-[0.1em] text-(--ink)/90 uppercase max-sm:text-(--ink-2) md:bg-(--canvas)/90 md:shadow-lg md:shadow-black/40 md:backdrop-blur-md sm:gap-x-2.5 sm:px-4 sm:text-[11px] sm:leading-none sm:tracking-[0.22em]",
        centered ? "justify-center text-center sm:w-fit sm:justify-center" : "justify-center sm:justify-between"
      )}
    >
      {items.map((item, i) => (
        <Fragment key={item}>
          {i > 0 && <EyebrowDot />}
          <span
            className={cn(
              "min-w-0 text-center [text-wrap:balance] sm:min-w-fit sm:whitespace-nowrap",
              accent && item.toLowerCase().includes(accent) && "text-(--gold)"
            )}
          >
            {item}
          </span>
        </Fragment>
      ))}
    </p>
  );
}

export function HomeHero({
  tagline,
  accentWord,
  tonightEvents,
  isTonight,
}: {
  tagline: string | null;
  accentWord?: string;
  tonightEvents: SerializedEvent[];
  isTonight: boolean;
}) {
  const primary = tonightEvents[0];

  return (
    <section
      className={cn(
        "relative flex flex-col pt-3 pb-4 sm:pt-4",
        tonightEvents.length > 1 && "md:pb-16",
        primary &&
          "md:grid md:grid-cols-[1fr_minmax(20rem,0.85fr)] md:grid-rows-[auto_1fr_auto] md:gap-x-5 md:gap-y-0 lg:gap-x-8"
      )}
    >
      {/* Eyebrow - pinned to the top of the poster on md+, so it lines up with the card's top edge */}
      <div
        className={cn(
          "relative z-30",
          primary ? "sm:w-fit md:col-span-2 md:col-start-1 md:row-start-1 md:self-start" : "mx-auto max-w-3xl text-center"
        )}
      >
        <OfferEyebrow tagline={tagline} accentWord={accentWord} centered={!primary} />
      </div>

      {/* Headline - centred against the poster on md+ */}
      <div
        className={cn(
          "relative z-10",
          primary ? "min-w-0 md:col-start-1 md:row-start-2 md:self-center md:py-4" : "mx-auto max-w-3xl text-center"
        )}
      >
        <KineticHeadline
          lines={[
            { text: "What's on" },
            { text: isTonight ? "Tonight" : "Next up", accent: true },
          ]}
          align={primary ? "start" : "center"}
          className={cn(
            "text-[clamp(2.75rem,13.5vw,4.5rem)] sm:text-7xl md:gap-y-2 md:text-[clamp(3rem,7.2vw,8.5rem)] lg:gap-y-3 lg:text-[clamp(4rem,6.4vw,7.5rem)]",
            !primary && "lg:text-8xl"
          )}
        />
      </div>

      {primary && (
        <div className="relative z-10 order-3 mt-5 sm:mt-8 md:order-none md:col-start-2 md:row-span-2 md:row-start-2 md:mt-0 md:min-w-0">
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
          "animate-reveal relative z-10 mt-5 flex flex-wrap items-center gap-2.5 [animation-delay:850ms] empty:hidden sm:mt-6",
          primary ? "order-2 md:order-none md:col-start-1 md:row-start-3 md:self-end" : "justify-center"
        )}
      >
        <MarketCta />
      </div>
    </section>
  );
}

