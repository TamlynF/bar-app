"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Menu as MenuIcon, X } from "lucide-react";
import { SiInstagram } from "react-icons/si";
import { SOCIAL_BRANDS } from "@/components/editorial/social-brands";
import { cn } from "@/lib/utils";
import { useMarketState } from "@/hooks/use-market-live";
import { MobileBottomBar } from "@/components/mobile-bottom-bar";
import { MarketTicker } from "@/components/market-ticker";

export function PublicNavBar({
  currentPath,
  overlay = false,
  instagramUrl,
}: {
  currentPath?: string;
  overlay?: boolean;
  instagramUrl: string | null;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const marketState = useMarketState();
  const marketLive = marketState.status === "live";
  const onMarketPage = currentPath?.startsWith("/market") ?? false;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const solid = scrolled || menuOpen;

  const primaryLinks = [
    { href: "/whats-on", label: "What's On" },
    { href: "/menu", label: "Menu" },
    { href: "/market", label: "Market" },
    { href: "/gallery", label: "Gallery" },
    { href: "/contact", label: "Contact" },
  ];

  const mobileLinks = [{ href: "/", label: "Home" }, ...primaryLinks];

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-40 h-[calc(env(safe-area-inset-top)+3.5rem)] bg-linear-to-b from-canvas via-canvas/55 to-canvas/0 sm:h-[calc(env(safe-area-inset-top)+4rem)]"
      />
      <nav
        className={cn(
          "fixed top-0 right-0 left-0 z-50 border-b transition-[background-color,border-color,backdrop-filter] duration-350 standalone:top-[env(safe-area-inset-top)]",
          solid
            ? "border-[#FDCC4B]/10 bg-canvas/88 backdrop-blur-xl"
            : "border-transparent bg-transparent"
        )}
      >
        <div className="mx-auto flex h-14 w-full max-w-400 items-center justify-between gap-4 px-4 sm:h-16 sm:gap-6 sm:px-6 lg:px-10">
          <Link
            href="/"
            className="inline-flex w-fit shrink-0 flex-col items-start gap-1"
            onClick={() => setMenuOpen(false)}
            aria-label="Don Fenticas - home"
          >
            <Image
              src="/CompanyName.png"
              alt=""
              width={869}
              height={176}
              className={cn(
                "h-8 w-auto object-contain sm:h-10",
                !solid && "drop-shadow-[0_2px_14px_rgba(0,0,0,0.75)]"
              )}
              priority
            />
            <span
              className={cn(
                "inline-flex items-center gap-1.5 font-black text-[7px] leading-none tracking-[0.28em] text-ink uppercase sm:text-[9px]",
                !solid && "drop-shadow-[0_1px_8px_rgba(0,0,0,0.9)]"
              )}
            >
              <span className="inline-block h-px w-2.5 bg-ink" aria-hidden="true" />
              Live music bar
            </span>
          </Link>

          <div className="hidden items-center gap-7 sm:flex lg:gap-9">
            {primaryLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "relative inline-flex items-center py-2 text-[11px] font-bold tracking-[0.14em] whitespace-nowrap uppercase transition-colors lg:text-xs",
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
                  <span className="rounded-full bg-[#FDCC4B] px-1.5 py-0.5 font-black text-[8px] leading-none tracking-[0.18em] text-[#1a2008]">
                    Open
                  </span>
                )}
              </Link>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-5 lg:gap-7">
            {instagramUrl && (
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Follow us on Instagram"
                className={cn(
                  "ad-installed-hidden inline-flex h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-full transition-transform hover:scale-105 active:scale-95 sm:order-last sm:h-9 sm:w-9 lg:h-10 lg:w-auto lg:px-4",
                  !solid && "ring-2 ring-canvas/60 shadow-lg shadow-black/40",
                  SOCIAL_BRANDS.instagram.solid
                )}
              >
                <SiInstagram className="h-5 w-5 shrink-0 sm:h-4 sm:w-4" aria-hidden="true" />
                <span className="hidden font-black text-[11px] tracking-wide whitespace-nowrap uppercase lg:inline">
                  Follow us
                </span>
              </a>
            )}

            <Link
              href="/book"
              className="hidden shrink-0 rounded-full bg-[#FDCC4B] px-4 py-2 font-black text-xs tracking-wide text-[#1a2008]! uppercase transition-colors hover:bg-[#e5b843] active:scale-95 sm:inline-flex lg:px-5 lg:text-sm"
            >
              Book
            </Link>

            <button
              type="button"
              aria-label={menuOpen ? "Close menu" : marketLive ? "Open menu (drinks market is open)" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="public-nav-drawer"
              onClick={() => setMenuOpen((o) => !o)}
              className={cn(
                "relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-canvas-2 hover:text-ink active:scale-95 sm:hidden",
                solid
                  ? "text-ink-2"
                  : "text-ink drop-shadow-[0_1px_10px_rgba(0,0,0,0.9)]"
              )}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
              {marketLive && !menuOpen && (
                <span
                  className="ad-live-dot absolute top-2 right-2 h-2 w-2 rounded-full bg-[#E6392E] ring-2 ring-canvas"
                  aria-hidden="true"
                />
              )}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div
            id="public-nav-drawer"
            className="animate-in border-t border-[#FDCC4B]/10 bg-canvas/95 backdrop-blur-xl duration-200 fade-in slide-in-from-top-2 sm:hidden"
          >
            <div className="mx-auto flex w-full max-w-400 flex-col px-4 py-3">
              <Link
                href="/book"
                onClick={() => setMenuOpen(false)}
                className="mb-2 inline-flex h-12 items-center justify-center rounded-2xl bg-[#FDCC4B] font-black text-sm tracking-wide text-[#1a2008]! uppercase transition-colors hover:bg-[#e5b843] active:scale-95"
              >
                Book
              </Link>
              {mobileLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "relative flex items-center justify-between rounded-xl px-3 py-3 text-sm font-bold tracking-wide uppercase transition-colors",
                    currentPath === link.href
                      ? "bg-canvas-2 text-[#FDCC4B]"
                      : "text-stone-400 hover:bg-canvas-2 hover:text-ink"
                  )}
                >
                  {link.label}
                  {marketLive && link.href === "/market" && (
                    <span className="relative inline-flex items-center gap-2 rounded-full bg-[#FDCC4B]/15 px-2.5 py-1 font-black text-[9px] tracking-[0.2em] text-[#FDCC4B] ring-1 ring-[#FDCC4B]/40">
                      <span className="ad-live-dot h-1.5 w-1.5 rounded-full bg-[#E6392E]" aria-hidden="true" />
                      Open now
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      {!overlay && <div className="h-14 sm:h-16" aria-hidden="true" />}

      {/* Overlay pages run their hero under the nav; pull the hero back up by
          the nav height so the strip only costs its own 44px. */}
      {!onMarketPage && <MarketTicker state={marketState} className={overlay ? "mt-14 -mb-14" : undefined} />}

      <MobileBottomBar currentPath={currentPath} instagramUrl={instagramUrl} marketLive={marketLive} />
    </>
  );
}
