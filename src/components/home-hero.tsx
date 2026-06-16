import Image from "next/image";
import Link from "next/link";
import { CalendarDays, ArrowRight } from "lucide-react";

/**
 * Public home hero — an immersive, awwwards-style editorial landing moment on
 * the bar's dark olive/gold palette. Oversized headline over a photographic
 * backdrop (first active gallery photo), brand wordmark, theme pills and two
 * CTAs. Falls back to a gold-blur olive panel when there's no photo.
 *
 * Per STYLE_GUIDE.md the brand wordmark is allowed here (home hero) + nav only.
 */
export function HomeHero({
  tagline,
  backdropUrl,
}: {
  tagline: string;
  backdropUrl: string | null;
}) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 min-h-112 sm:min-h-128 flex flex-col justify-end">
      {/* Backdrop */}
      {backdropUrl ? (
        <>
          <Image
            src={backdropUrl}
            alt=""
            fill
            priority
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-t from-[#1a2008] via-[#1a2008]/80 to-[#1a2008]/30" />
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-[#26300D]" />
          <div className="absolute -top-10 left-0 w-[120%] max-w-2xl h-64 bg-[#FDCC4B]/10 blur-[100px] rounded-[100%] pointer-events-none" />
        </>
      )}

      {/* Foreground */}
      <div className="relative z-10 p-6 sm:p-12">
        <div className="animate-reveal inline-flex items-center gap-1.5 bg-[#FDCC4B]/10 border border-[#FDCC4B]/20 rounded-full px-3 py-1 mb-5">
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#FDCC4B]">
            Hinckley &middot; Live Music &amp; Late Nights
          </span>
        </div>

        <h1 className="animate-reveal [animation-delay:80ms] m-0">
          <Image
            src="/CompanyName.png"
            alt="Don Fenticas — live music bar in Hinckley"
            width={420}
            height={112}
            priority
            className="h-16 sm:h-24 w-auto object-contain drop-shadow-xl"
          />
        </h1>

        <p className="animate-reveal [animation-delay:160ms] mt-4 max-w-md text-stone-200 text-sm sm:text-base font-medium leading-relaxed line-clamp-3 drop-shadow">
          {tagline}
        </p>

        {/* Theme pills */}
        <div className="animate-reveal [animation-delay:240ms] mt-6 flex gap-2 overflow-x-auto no-scrollbar">
          <span className="pill-neon-orange border shrink-0 text-[9px] font-black uppercase tracking-[0.15em] h-9 px-4 flex items-center justify-center rounded-full backdrop-blur cursor-default">
            Live Music
          </span>
          <span className="pill-neon-pink border shrink-0 text-[9px] font-black uppercase tracking-[0.15em] h-9 px-4 flex items-center justify-center rounded-full backdrop-blur cursor-default">
            Indie &amp; Rock
          </span>
          <span className="pill-neon-cyan border shrink-0 text-[9px] font-black uppercase tracking-[0.15em] h-9 px-4 flex items-center justify-center rounded-full backdrop-blur cursor-default">
            DJs
          </span>
          <span className="pill-neon-lime border shrink-0 text-[9px] font-black uppercase tracking-[0.15em] h-9 px-4 flex items-center justify-center rounded-full backdrop-blur cursor-default">
            Karaoke
          </span>
        </div>

        {/* CTAs */}
        <div className="animate-reveal [animation-delay:320ms] mt-7 flex flex-wrap gap-3">
          <Link
            href="/book"
            className="inline-flex items-center justify-center gap-2 h-12 px-7 rounded-full bg-[#FDCC4B] text-[#1a2008] text-sm font-black uppercase tracking-wide hover:bg-[#e5b843] active:scale-95 transition-all"
          >
            <CalendarDays className="w-4 h-4" aria-hidden="true" />
            Book
          </Link>
          <Link
            href="/whats-on"
            className="inline-flex items-center justify-center gap-2 h-12 px-7 rounded-full border border-white/25 bg-white/5 text-white text-sm font-black uppercase tracking-wide hover:bg-white/15 hover:border-white/40 active:scale-95 transition-all"
          >
            What&apos;s On
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
