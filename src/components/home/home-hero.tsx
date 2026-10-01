import Image from "next/image";
import { ArrowCta } from "@/components/ui/arrow-cta";
import { CompanyWordmark } from "@/components/company-wordmark";
import { NextUpTicket } from "@/components/home/next-up-ticket";
import { WeeklyStrip } from "@/components/home/weekly-strip";
import type { SerializedEvent } from "@/lib/events-display";

/* First screen of the home page: a photo of the room with the statement over
   it, the weekly rhythm directly beneath, and the next dated night as a
   ticket - beside the statement on wide screens, after the weekly strip on
   phones. Everything a first-time visitor needs is above the fold. */
const BACKDROP = "/backdrop.jpeg";

export function HomeHero({ featured, today }: { featured: SerializedEvent | null; today: Date }) {
  return (
    <section aria-labelledby="home-heading" className="relative isolate w-full">
      <Image
        src={BACKDROP}
        alt=""
        fill
        priority
        sizes="100vw"
        className="-z-20 object-contain object-top mask-b-from-[40vw] mask-b-to-[56.25vw] sm:object-cover sm:object-center sm:mask-none"
      />
      <div className="absolute inset-0 -z-10 bg-linear-to-b from-canvas/60 via-canvas/75 to-canvas" aria-hidden="true" />

      <div className="mx-auto w-full max-w-400">
        <div className="grid grid-cols-1 gap-8 px-4 pt-10 pb-5 sm:min-h-66 sm:px-6 sm:pt-8 lg:min-h-155 lg:grid-cols-12 lg:gap-8 lg:px-10 lg:py-12">
          <div className="flex flex-col justify-end gap-3 lg:col-span-7 lg:gap-5">
            <hgroup className="@container flex flex-col gap-3 sm:hidden">
              <h1 translate="no">
                <CompanyWordmark priority className="w-full" />
              </h1>
              <p className="text-justify text-[7.6cqw] leading-none font-semibold font-stretch-condensed tracking-wide whitespace-nowrap text-ink uppercase [text-align-last:justify]">
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
              <span className="lg:hidden">Bands, pub quiz, karaoke and DJs. Regent Street, Thursday to Saturday, till late.</span>
              <span className="hidden lg:inline">
                Bands and tributes on the stage, a pub quiz on Thursdays, karaoke on Fridays and a DJ after the band on
                Saturdays. Regent Street, Thursday to Saturday, till late.
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
              today={today}
              headingId="next-up-heading-wide"
              className="hidden self-center lg:col-span-4 lg:col-start-9 lg:flex"
            />
          )}
        </div>

        <div className="flex flex-col gap-12 px-4 pt-12 pb-8 sm:gap-8 sm:px-6 sm:pt-2 lg:px-10 lg:pt-4 lg:pb-12">
          <WeeklyStrip />
          {featured && <NextUpTicket event={featured} today={today} headingId="next-up-heading" className="lg:hidden" />}
        </div>
      </div>
    </section>
  );
}
