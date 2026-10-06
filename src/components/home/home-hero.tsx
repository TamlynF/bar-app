import Image from "next/image";
import { ArrowCta } from "@/components/ui/arrow-cta";
import { Logo3DLazy } from "@/components/logo-3d-lazy";
import { NextUpTicket } from "@/components/home/next-up-ticket";
import { WeeklyStrip } from "@/components/home/weekly-strip";
import type { EventSpace, SerializedEvent } from "@/lib/events-display";
import type { OpeningHours } from "@/lib/opening-hours";

/* First screen of the home page: a photo of the room with the statement over
   it, the weekly rhythm directly beneath, and the next dated night as a
   ticket - beside the statement on wide screens, after the weekly strip on
   phones. Everything a first-time visitor needs is above the fold. */
const BACKDROP = "/backdrop.jpeg";

export function HomeHero({
  featured,
  featuredSpace,
  today,
  hours,
  karaokeUrl,
}: {
  featured: SerializedEvent | null;
  featuredSpace?: EventSpace | null;
  today: Date;
  hours?: OpeningHours | null;
  karaokeUrl?: string | null;
}) {
  return (
    <section aria-labelledby="home-heading" className="relative isolate w-full">
      <Image
        src={BACKDROP}
        alt=""
        fill
        priority
        sizes="100vw"
        className="-z-20 hidden object-cover object-center sm:block"
      />
      <div
        className="absolute inset-0 -z-10 hidden bg-linear-to-b from-canvas/60 via-canvas/75 to-canvas sm:block"
        aria-hidden="true"
      />

      <div className="mx-auto w-full max-w-400">
        <div className="relative isolate">
          <div className="absolute inset-0 -z-10 overflow-hidden sm:hidden" aria-hidden="true">
            <Image src={BACKDROP} alt="" fill sizes="100vw" className="scale-125 object-cover object-top blur-2xl" />
            <Image
              src={BACKDROP}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-contain object-top mask-b-from-[40vw] mask-b-to-[56.25vw]"
            />
            <div className="absolute inset-0 bg-linear-to-b from-canvas/55 via-canvas/70 via-60% to-canvas" />
          </div>
          <div className="grid grid-cols-1 gap-8 px-4 pt-10 pb-5 sm:min-h-66 sm:px-6 sm:pt-8 lg:min-h-155 lg:grid-cols-12 lg:gap-8 lg:px-10 lg:py-12">
            <div className="flex flex-col justify-end gap-3 lg:col-span-7 lg:gap-5">
              <hgroup className="@container flex flex-col gap-3 sm:hidden">
                <h1 translate="no">
                  <Logo3DLazy />
                </h1>
                <p className="px-[4%] text-[4.43cqw] leading-none font-semibold tracking-[0.2em] whitespace-nowrap text-ink uppercase [text-shadow:1px_1px_0_#5a6b26,2px_2px_0_#4a5a1e,3px_3px_0_#3c4a18,4px_4px_10px_rgb(0_0_0/0.6)]">
                  Hinckley’s live music venue
                </p>
              </hgroup>
              <p className="hidden items-center gap-2.5 text-eyebrow font-semibold text-gold sm:flex">
                <span className="h-0.5 w-7 bg-gold" aria-hidden="true" />
                Hinckley&apos;s live music bar
              </p>
              <h1
                id="home-heading"
                className="hidden font-black text-[clamp(2.75rem,9vw,7rem)] leading-[0.88] tracking-tighter text-ink uppercase sm:block"
              >
                Live music.
                <br />
                Every week.
              </h1>
              <p className="hidden max-w-lg text-body font-medium text-ink sm:block">
                <span className="lg:hidden">
                  Bands, pub quiz, karaoke and DJs. Regent Street, Thursday to Saturday, till late.
                </span>
                <span className="hidden lg:inline">
                  Bands and tributes on the stage, a pub quiz on Thursdays, karaoke on Fridays and a DJ after the band
                  on Saturdays. Regent Street, Thursday to Saturday, till late.
                </span>
              </p>
              <div className="hidden gap-2 lg:flex">
                <ArrowCta href="/book" variant="gold">
                  Book a table
                </ArrowCta>
                <ArrowCta href="/whats-on" variant="goldOutline">
                  See what&apos;s on
                </ArrowCta>
              </div>
            </div>

            {featured && (
              <NextUpTicket
                event={featured}
                space={featuredSpace}
                today={today}
                headingId="next-up-heading-wide"
                className="hidden self-center lg:col-span-4 lg:col-start-9 lg:flex"
              />
            )}
          </div>

          <div className="px-4 pt-8 max-sm:pb-12 sm:px-6 sm:pt-2 sm:pb-8 lg:px-10 lg:pt-4 lg:pb-12">
            <WeeklyStrip hours={hours} karaokeUrl={karaokeUrl} />
          </div>
        </div>

        {featured && (
          <div className="px-4 pb-8 sm:px-6 lg:hidden">
            <NextUpTicket event={featured} space={featuredSpace} today={today} headingId="next-up-heading" />
          </div>
        )}
      </div>
    </section>
  );
}
