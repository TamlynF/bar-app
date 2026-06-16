import Image from "next/image";
import Link from "next/link";
import { CalendarDays, ArrowRight } from "lucide-react";

/**
 * Public home hero — the venue's landing moment.
 *
 * Brand wordmark + tagline over a photographic backdrop (the first active
 * gallery photo, passed in by the page), with two clear CTAs. Falls back to
 * the gold-blur gradient treatment when there's no photo to show.
 *
 * Per STYLE_GUIDE.md the brand wordmark is allowed here (home hero) and in the
 * nav only — sub-pages must not repeat it.
 */
export function HomeHero({
  tagline,
  backdropUrl,
}: {
  tagline: string;
  backdropUrl: string | null;
}) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 min-h-[24rem] sm:min-h-[28rem] flex flex-col justify-end">
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
          <div className="absolute inset-0 bg-linear-to-t from-[#1a2008] via-[#1a2008]/85 to-[#1a2008]/40" />
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-[#26300D]" />
          <div className="absolute -top-10 left-0 w-[120%] max-w-2xl h-64 bg-[#FDCC4B]/10 blur-[100px] rounded-[100%] pointer-events-none" />
        </>
      )}

      {/* Foreground */}
      <div className="relative z-10 p-6 sm:p-10">
        <Image
          src="/CompanyName.png"
          alt="Don Fenticas"
          width={420}
          height={112}
          priority
          className="h-14 sm:h-20 w-auto object-contain drop-shadow-xl"
        />

        <p className="mt-4 max-w-md text-stone-200 text-sm sm:text-base font-medium leading-relaxed drop-shadow">
          {tagline}
        </p>

        {/* Theme pills */}
        <div className="mt-5 flex gap-2 overflow-x-auto no-scrollbar">
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
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/book"
            className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full bg-[#FDCC4B] text-[#1a2008] text-sm font-black uppercase tracking-wide hover:bg-[#e5b843] active:scale-95 transition-all"
          >
            <CalendarDays className="w-4 h-4" aria-hidden="true" />
            Book
          </Link>
          <Link
            href="/whats-on"
            className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full border border-white/25 bg-white/5 text-white text-sm font-black uppercase tracking-wide hover:bg-white/15 hover:border-white/40 active:scale-95 transition-all"
          >
            What&apos;s On
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
