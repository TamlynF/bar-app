"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { SiInstagram } from "react-icons/si";
import { SOCIAL_BRANDS } from "@/components/editorial/social-brands";
import { cn } from "@/lib/utils";
import type { BarStatus } from "@/lib/opening-hours";
import { useMarketState } from "@/hooks/use-market-live";
import { MobileBottomBar } from "@/components/mobile-bottom-bar";
import { MarketTicker } from "@/components/market-ticker";

export function PublicNavBar({
  currentPath,
  overlay = false,
  ticker = false,
  instagramUrl,
  status = null,
}: {
  currentPath?: string;
  overlay?: boolean;
  ticker?: boolean;
  instagramUrl: string | null;
  status?: BarStatus | null;
}) {
  const [scrolled, setScrolled] = useState(false);
  const marketState = useMarketState();
  const marketLive = marketState.status === "live";
  const marketCrash = marketLive && Boolean(marketState.crashActive);
  const onMarketPage = currentPath?.startsWith("/market") ?? false;
  const marketPill = marketLive && !onMarketPage;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const solid = scrolled;

  const primaryLinks = [
    { href: "/whats-on", label: "What's On" },
    { href: "/menu", label: "Menu" },
    { href: "/market", label: "Market" },
    { href: "/gallery", label: "Gallery" },
    { href: "/contact", label: "Contact" },
  ];


  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-40 h-[calc(env(safe-area-inset-top)+3rem)] bg-linear-to-b from-canvas via-canvas/55 to-canvas/0 sm:h-[calc(env(safe-area-inset-top)+4rem)]"
      />
      <nav
        className={cn(
          "fixed top-0 right-0 left-0 z-50 border-b transition-[background-color,border-color,backdrop-filter] duration-350 standalone:top-[env(safe-area-inset-top)]",
          solid
            ? "border-[#FDCC4B]/10 bg-canvas/88 backdrop-blur-xl"
            : "border-transparent bg-transparent"
        )}
      >
        <div className="mx-auto flex h-12 w-full max-w-400 items-center justify-between gap-3 px-4 sm:h-16 sm:gap-6 sm:px-6 lg:px-10">
          <div className="flex min-w-0 shrink items-center gap-2.5">
            <Link
              href="/"
              className="inline-flex w-fit shrink-0 flex-col items-start gap-1"
              aria-label="Don Fenticas - home"
            >
              <Image
                src="/short_logo_transparent.png"
                alt=""
                width={2000}
                height={2000}
                sizes="36px"
                className={cn("h-9 w-9 object-contain sm:hidden", !solid && "drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]")}
                priority
              />
              <Image
                src="/CompanyName.png"
                alt=""
                width={869}
                height={176}
                className={cn(
                  "hidden h-10 w-auto object-contain sm:block",
                  !solid && "drop-shadow-[0_2px_14px_rgba(0,0,0,0.75)]"
                )}
                priority
              />
              <span
                className={cn(
                  "hidden items-center gap-1.5 text-eyebrow font-semibold leading-none text-ink sm:inline-flex",
                  !solid && "drop-shadow-[0_1px_8px_rgba(0,0,0,0.9)]"
                )}
              >
                <span className="inline-block h-px w-2.5 bg-ink" aria-hidden="true" />
                Live music bar
              </span>
            </Link>
            {status && (
              <Link
                href="/contact"
                aria-label={`${status.label} - opening hours`}
                className={cn(
                  "inline-flex min-h-11 min-w-0 items-center text-eyebrow font-semibold leading-none text-ink transition-opacity active:opacity-70 sm:hidden",
                  !solid && "drop-shadow-[0_1px_8px_rgba(0,0,0,0.9)]"
                )}
              >
                <span className="truncate max-[374px]:hidden">{status.label}</span>
                <span className="truncate min-[375px]:hidden">{status.shortLabel}</span>
              </Link>
            )}
          </div>

          <div className="hidden items-center gap-7 sm:flex lg:gap-9">
            {primaryLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "relative inline-flex items-center py-2 text-nav font-semibold whitespace-nowrap transition-colors",
                  currentPath === link.href ? "text-[#FDCC4B]" : "hover:text-ink",
                  currentPath !== link.href && (solid ? "text-stone-400" : "text-ink"),
                  !solid && "drop-shadow-[0_1px_10px_rgba(0,0,0,0.9)]",
                  marketLive &&
                    link.href === "/market" &&
                    "ad-market-live -my-1 gap-2 rounded-full bg-[#FDCC4B]/12 px-3 py-1.5 text-[#FDCC4B] ring-1 ring-[#FDCC4B]/45 drop-shadow-none hover:bg-[#FDCC4B]/20 hover:text-[#FDCC4B]"
                )}
              >
                {marketLive && link.href === "/market" && (
                  <span className="ad-live-dot h-1.5 w-1.5 shrink-0 rounded-full bg-[#E6392E]" aria-hidden="true" />
                )}
                {link.label}
                {marketLive && link.href === "/market" && (
                  <span className="rounded-full bg-[#FDCC4B] px-1.5 py-0.5 text-pill font-bold leading-none tracking-wide text-[#1a2008] uppercase">
                    Open
                  </span>
                )}
              </Link>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-5 lg:gap-7">
            {marketPill && (
              <Link
                href="/market"
                aria-label={marketCrash ? "Drinks exchange crash - see live prices" : "Drinks exchange is open - see live prices"}
                className={cn(
                  "ad-market-live relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-transform active:scale-95 sm:hidden",
                  marketCrash
                    ? "border-[#FF6B35]/60 bg-[#FF6B35]/15 text-[#FF6B35]"
                    : "border-gold/50 bg-gold/10 text-gold",
                  !solid && "shadow-md shadow-black/40 backdrop-blur-md"
                )}
              >
                <TrendingUp className="h-4 w-4" aria-hidden="true" />
                <span
                  className={cn(
                    "ad-live-dot absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-canvas",
                    marketCrash ? "bg-white" : "bg-[#E6392E]"
                  )}
                  aria-hidden="true"
                />
              </Link>
            )}
            {instagramUrl && (
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Follow us on Instagram"
                className={cn(
                  "relative h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full px-0 transition-transform before:absolute before:-inset-1 hover:scale-105 active:scale-95 sm:order-last sm:inline-flex lg:h-10 lg:w-auto lg:px-4",
                  "inline-flex",
                  !solid && "ring-2 ring-canvas/60 shadow-lg shadow-black/40",
                  SOCIAL_BRANDS.instagram.solid
                )}
              >
                <SiInstagram className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="hidden text-nav font-semibold whitespace-nowrap lg:inline">
                  Follow us
                </span>
              </a>
            )}

            <Link
              href="/book"
              className="hidden shrink-0 rounded-full bg-[#FDCC4B] px-4 py-2 text-btn font-semibold text-[#1a2008]! transition-colors hover:bg-[#e5b843] active:scale-95 sm:inline-flex lg:px-5 lg:text-sm"
            >
              Book
            </Link>

          </div>
        </div>

      </nav>

      {!overlay && <div className="h-12 sm:h-16" aria-hidden="true" />}

      {/* Home only: the deal strip under the top bar. Overlay pages would run
          their hero under the nav; pull the hero back up by the nav height so
          the strip only costs its own 44px. */}
      {ticker && <MarketTicker state={marketState} className={overlay ? "mt-12 -mb-12" : undefined} />}

      <MobileBottomBar currentPath={currentPath} />
    </>
  );
}
