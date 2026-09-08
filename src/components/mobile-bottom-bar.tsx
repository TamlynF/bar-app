"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, Sparkles, TrendingUp, UtensilsCrossed } from "lucide-react";
import { SiInstagram } from "react-icons/si";
import { cn } from "@/lib/utils";

const HIDE_AFTER_PX = 12;
const SHOW_NEAR_TOP_PX = 80;

/* Thumb bar for the installed (home-screen) app only, where there is no
   browser chrome and people flip between sections all evening. Browser
   visitors get the top nav and drawer instead. Four slots: Tonight, Book,
   Menu and Follow, with Menu giving way to Market while a market trades.
   Slides away while scrolling down, returns on scroll up or near the top. */
export function MobileBottomBar({
  currentPath,
  instagramUrl,
  marketLive,
}: {
  currentPath?: string;
  instagramUrl: string | null;
  marketLive: boolean;
}) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY;
        if (y < SHOW_NEAR_TOP_PX) setHidden(false);
        else if (delta > HIDE_AFTER_PX) setHidden(true);
        else if (delta < -HIDE_AFTER_PX) setHidden(false);
        lastY = y;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const items = [
    { href: "/#tonight", label: "Tonight", Icon: Sparkles, active: currentPath === "/", live: false },
    { href: "/book", label: "Book", Icon: CalendarDays, active: currentPath?.startsWith("/book") ?? false, live: false },
    marketLive
      ? { href: "/market", label: "Market", Icon: TrendingUp, active: currentPath?.startsWith("/market") ?? false, live: true }
      : { href: "/menu", label: "Menu", Icon: UtensilsCrossed, active: currentPath === "/menu", live: false },
  ];

  return (
    <nav
      aria-label="Quick actions"
      className={cn(
        "ad-installed-only fixed inset-x-0 bottom-0 z-40 transition-transform duration-300 ease-out",
        hidden && "translate-y-full"
      )}
    >
      <div className="mx-auto flex items-stretch justify-around border-t border-white/10 bg-canvas/92 px-2 pt-1.5 pb-[calc(env(safe-area-inset-bottom)+0.375rem)] backdrop-blur-xl">
        {items.map(({ href, label, Icon, active, live }) => (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex min-w-16 flex-col items-center gap-1 rounded-xl px-3 py-1.5 font-black text-[10px] tracking-[0.14em] uppercase transition-colors",
              active ? "text-gold" : live ? "text-ink" : "text-ink-2 active:text-ink"
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            {label}
            {live && (
              <span
                className="ad-live-dot absolute top-0.5 right-2.5 h-2 w-2 rounded-full bg-[#E6392E] ring-2 ring-canvas"
                aria-hidden="true"
              />
            )}
          </Link>
        ))}
        {instagramUrl && (
          <a
            href={instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Follow us on Instagram"
            className="flex min-w-16 flex-col items-center gap-1 rounded-xl px-3 py-1.5 font-black text-[10px] tracking-[0.14em] text-ink-2 uppercase transition-colors active:text-ink"
          >
            <SiInstagram className="h-5 w-5 text-[#E1306C]" aria-hidden="true" />
            Follow
          </a>
        )}
      </div>
    </nav>
  );
}
