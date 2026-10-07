"use client";

import Link from "next/link";
import { Mic2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMarketLive } from "@/hooks/use-market-live";
import { cn } from "@/lib/utils";

export type KaraokeTonight = { url: string | null };

const ACTION = "h-11 w-full rounded-[14px] px-3.75 text-xs font-extrabold tracking-[0.06em] uppercase";
const GOLD =
  "shadow-[0_3px_0_#a8801c,0_10px_20px_-10px_rgb(0_0_0/0.8)] active:translate-y-0.5 active:shadow-[0_1px_0_#a8801c]";
const SINGA =
  "bg-[#FD632B] text-[#1a0d05] shadow-[0_3px_0_#a93d14,0_10px_20px_-10px_rgb(0_0_0/0.8)] hover:bg-[#FD632B] active:translate-y-0.5 active:shadow-[0_1px_0_#a93d14]";
const OUTLINE =
  "border-[1.5px] border-ink/45 bg-canvas/55 text-ink backdrop-blur-[8px] shadow-[0_3px_0_rgb(0_0_0/0.6),0_10px_20px_-10px_rgb(0_0_0/0.8)] hover:bg-ink/10 active:translate-y-0.5 active:shadow-[0_1px_0_rgb(0_0_0/0.6)]";

/* The two buttons under the phone hero's wordmark. The first is the night's
   headline act: "What's on" most days, the Singa request link on a karaoke
   night. The second is "Book a table" until the drinks exchange opens, when
   it points at the live board instead. */
export function HeroActions({
  karaokeTonight,
  bookHref = "/book",
  className,
  id,
}: {
  karaokeTonight: KaraokeTonight | null;
  bookHref?: string;
  className?: string;
  id?: string;
}) {
  const marketLive = useMarketLive();

  return (
    <div id={id} className={cn("grid grid-cols-2 gap-2", className)}>
      {karaokeTonight ? (
        karaokeTonight.url ? (
          <Button asChild variant="gold" size="cta" className={cn(ACTION, SINGA)}>
            <a
              href={karaokeTonight.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Request a song tonight on Singa"
            >
              <Mic2 className="size-4" aria-hidden="true" />
              Sing on Singa
            </a>
          </Button>
        ) : (
          <span
            aria-disabled="true"
            className={cn(
              ACTION,
              "pointer-events-none inline-flex items-center justify-center gap-2 border border-dashed border-ink/30 text-[11px] text-ink-2"
            )}
          >
            <Mic2 className="size-4" aria-hidden="true" />
            Karaoke not started
          </span>
        )
      ) : (
        <Button asChild variant="gold" size="cta" className={cn(ACTION, GOLD)}>
          <Link href="/whats-on">What&apos;s on</Link>
        </Button>
      )}

      {marketLive ? (
        <Button asChild variant="goldOutline" size="cta" className={cn(ACTION, OUTLINE)}>
          <Link href="/market" aria-label="Drinks exchange is trading - see live prices">
            <span className="ad-live size-2 shrink-0 rounded-full bg-[#3DDC84]" aria-hidden="true" />
            Drinks exchange
          </Link>
        </Button>
      ) : (
        <Button asChild variant="goldOutline" size="cta" className={cn(ACTION, OUTLINE)}>
          <Link href={bookHref}>Book a table</Link>
        </Button>
      )}
    </div>
  );
}
