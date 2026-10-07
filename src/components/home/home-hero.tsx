import Image from "next/image";
import { ArrowCta } from "@/components/ui/arrow-cta";
import { Logo3DLazy } from "@/components/logo-3d-lazy";
import type { KaraokeTonight } from "@/components/home/hero-actions";
import { HeroStatement } from "@/components/home/hero-statement";
import { NextUpTicket } from "@/components/home/next-up-ticket";
import { WeeklyStrip } from "@/components/home/weekly-strip";
import type { EventSpace, SerializedEvent } from "@/lib/events-display";
import type { OpeningHours } from "@/lib/opening-hours";
import { cn } from "@/lib/utils";

/* First screen of the home page: a photo of the room with the statement over
   it, the weekly rhythm directly beneath, and the next dated night as a
   ticket - beside the statement on wide screens, after the weekly strip on
   phones. Everything a first-time visitor needs is above the fold. */
const BACKDROP = "/backdrop.jpeg";

/* Phone hero only: a lighting truss along the top edge with three lamps,
   and three soft beams that sweep slowly across the room behind the
   wordmark. */
const BEAM =
  "ad-sweep pointer-events-none absolute top-0 -z-10 h-180 sm:hidden w-30 origin-top mix-blend-screen blur-[14px] mask-b-from-30% mask-b-to-80% [--sweep-base:-18deg]";
const GOLD_BEAM =
  "bg-[conic-gradient(from_173deg_at_50%_0,transparent_0deg,rgb(253_204_75/0.38)_2deg_12deg,transparent_14deg)]";
const NEON_BEAM =
  "bg-[conic-gradient(from_173deg_at_50%_0,transparent_0deg,rgb(255_107_53/0.3)_2deg_12deg,transparent_14deg)]";
const LAMP =
  "absolute top-px size-2.5 rounded-full bg-[radial-gradient(circle_at_50%_50%,#fff3c4_0_25%,#c99a2e_45%,#2a2616_70%)] shadow-[0_0_0_1px_rgb(0_0_0/0.5),0_0_10px_2px_rgb(253_204_75/0.35)]";

export function HomeHero({
  featured,
  featuredSpace,
  today,
  hours,
  karaokeUrl,
  quizUrl,
  karaokeTonight = null,
}: {
  featured: SerializedEvent | null;
  featuredSpace?: EventSpace | null;
  today: Date;
  hours?: OpeningHours | null;
  karaokeUrl?: string | null;
  quizUrl?: string | null;
  karaokeTonight?: KaraokeTonight | null;
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
        <div className="relative isolate max-sm:flex max-sm:min-h-[calc(100dvh-220px-env(safe-area-inset-bottom))] max-sm:flex-col max-sm:justify-center max-sm:overflow-x-clip max-sm:bg-[radial-gradient(120%_70%_at_50%_100%,#2b2d12,#14180a_60%)]">
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
            <div className="absolute inset-x-0 top-0 h-1.5 border-b border-[#22251a] bg-[#0a0c05]">
              <span className={cn(LAMP, "left-19")} />
              <span className={cn(LAMP, "left-47.5")} />
              <span className={cn(LAMP, "left-76")} />
            </div>
          </div>
          <span className={cn(BEAM, GOLD_BEAM, "left-5")} aria-hidden="true" />
          <span className={cn(BEAM, NEON_BEAM, "left-34 [--sweep-duration:16s]")} aria-hidden="true" />
          <span className={cn(BEAM, GOLD_BEAM, "ad-sweep-reverse left-62 [--sweep-duration:13s]")} aria-hidden="true" />
          <div className="grid grid-cols-1 gap-8 px-4 pt-10 pb-5 max-sm:py-8 sm:min-h-66 sm:px-6 sm:pt-8 lg:min-h-155 lg:grid-cols-12 lg:gap-8 lg:px-10 lg:py-12">
            <div className="flex flex-col justify-end gap-3 lg:col-span-7 lg:gap-5">
              <HeroStatement karaokeTonight={karaokeTonight}>
                <h1 translate="no">
                  <Logo3DLazy />
                </h1>
              </HeroStatement>
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
        </div>

        <div className="px-4 pt-8 max-sm:pb-12 sm:px-6 sm:pt-2 sm:pb-8 lg:px-10 lg:pt-4 lg:pb-12">
          <WeeklyStrip hours={hours} karaokeUrl={karaokeUrl} quizUrl={quizUrl} />
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
