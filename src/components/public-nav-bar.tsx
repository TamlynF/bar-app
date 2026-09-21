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

export type TopBarStatus = { tone: "live" | "open"; label: string };

export function PublicNavBar({
  currentPath,
  overlay = false,
  ticker = true,
  instagramUrl,
  instagramHandle = null,
  status = null,
}: {
  currentPath?: string;
  overlay?: boolean;
  ticker?: boolean;
  instagramUrl: string | null;
  instagramHandle?: string | null;
  status?: TopBarStatus | null;
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

  const drawerLinks = primaryLinks.filter((l) => l.href === "/gallery" || l.href === "/contact");

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
              onClick={() => setMenuOpen(false)}
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
                href="/#tonight"
                onClick={() => setMenuOpen(false)}
                className={cn(
                  "inline-flex h-8 min-w-0 items-center gap-2 rounded-full border border-gold/50 py-1 pr-3 pl-2.5 backdrop-blur-md transition-colors active:bg-gold/15 sm:hidden",
                  solid ? "bg-gold/10" : "bg-canvas/70 shadow-md shadow-black/40"
                )}
              >
                <span
                  className={cn("ad-live-dot h-2 w-2 shrink-0 rounded-full", status.tone === "live" ? "bg-neon" : "bg-gold")}
                  aria-hidden="true"
                />
                <span className={cn("truncate text-eyebrow font-semibold leading-none", status.tone === "live" ? "text-ink" : "text-gold")}>
                  {status.label}
                </span>
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
            {instagramUrl && (
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Follow us on Instagram"
                className={cn(
                  "ad-installed-hidden hidden h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full transition-transform hover:scale-105 active:scale-95 sm:order-last sm:inline-flex lg:h-10 lg:w-auto lg:px-4",
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
              {drawerLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "relative flex items-center justify-between rounded-xl px-3 py-3 text-body font-semibold transition-colors",
                    currentPath === link.href
                      ? "bg-canvas-2 text-[#FDCC4B]"
                      : "text-stone-400 hover:bg-canvas-2 hover:text-ink"
                  )}
                >
                  {link.label}
                  {marketLive && link.href === "/market" && (
                    <span className="relative inline-flex items-center gap-2 rounded-full bg-[#FDCC4B]/15 px-2.5 py-1 text-eyebrow font-semibold text-[#FDCC4B] ring-1 ring-[#FDCC4B]/40">
                      <span className="ad-live-dot h-1.5 w-1.5 rounded-full bg-[#E6392E]" aria-hidden="true" />
                      Open now
                    </span>
                  )}
                </Link>
              ))}
              {instagramUrl && (
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMenuOpen(false)}
                  className="mt-2 flex min-h-13 items-center gap-3 rounded-xl border-t border-white/10 px-3 pt-3 text-stone-400 transition-colors hover:text-ink active:bg-canvas-2"
                >
                  <span className={cn("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full", SOCIAL_BRANDS.instagram.solid)}>
                    <SiInstagram className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-body font-semibold">Follow us</span>
                    {instagramHandle && <span className="block truncate text-xs text-ink-2 normal-case">{instagramHandle}</span>}
                  </span>
                </a>
              )}
            </div>
          </div>
        )}
      </nav>

      {!overlay && <div className="h-12 sm:h-16" aria-hidden="true" />}

      {/* Overlay pages run their hero under the nav; pull the hero back up by
          the nav height so the strip only costs its own 44px. The home page
          opts out and places the ticker under its poster instead. */}
      {ticker && !onMarketPage && <MarketTicker state={marketState} className={overlay ? "mt-12 -mb-12" : undefined} />}

      <MobileBottomBar currentPath={currentPath} marketLive={marketLive} />
    </>
  );
}
