"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Gamepad2, Home, Mic2, Music, UtensilsCrossed } from "lucide-react";
import { Waveform } from "@/components/ui/waveform";
import { cn } from "@/lib/utils";

const HIDE_AFTER_PX = 12;
const SHOW_NEAR_TOP_PX = 80;

/* Thumb bar for phones: five slots - Home, What's on, Market, Book and
   Menu - so the top bar can stay at logo, status and a short drawer.
   Slides away while scrolling down, returns on scroll up or near the top.
   Hidden from `sm` up, where the top nav carries the links. */
export function MobileBottomBar({ currentPath, marketLive }: { currentPath?: string; marketLive: boolean }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let travelled = 0;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY;
        travelled = Math.sign(delta) === Math.sign(travelled) ? travelled + delta : delta;
        if (y < SHOW_NEAR_TOP_PX) setHidden(false);
        else if (travelled > HIDE_AFTER_PX) setHidden(true);
        else if (travelled < -HIDE_AFTER_PX) setHidden(false);
        lastY = y;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const items = [
    { href: "/", label: "Home", Icon: Home, active: currentPath === "/", live: false },
    { href: "/whats-on", label: "What's on", Icon: Music, active: currentPath?.startsWith("/whats-on") ?? false, live: false },
    { href: "/market", label: "Market", Icon: Gamepad2, active: currentPath?.startsWith("/market") ?? false, live: marketLive },
    { href: "/book", label: "Book", Icon: Mic2, active: currentPath?.startsWith("/book") ?? false, live: false },
    { href: "/menu", label: "Menu", Icon: UtensilsCrossed, active: currentPath === "/menu", live: false },
  ];

  return (
    <nav
      aria-label="Quick actions"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 transition-transform duration-300 ease-out sm:hidden",
        hidden && "translate-y-full"
      )}
    >
      <div className="mx-auto flex items-stretch justify-around border-t border-white/10 bg-canvas/92 px-1 pt-1.5 pb-[calc(env(safe-area-inset-bottom)+0.375rem)] backdrop-blur-xl">
        {items.map(({ href, label, Icon, active, live }) => (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex min-h-11 min-w-14 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-pill font-semibold whitespace-nowrap transition-colors",
              active ? "text-gold" : live ? "text-ink" : "text-ink-2 active:text-ink"
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            {label}
            {active && <Waveform bars={5} className="absolute -bottom-0.5 h-1.5 text-gold" barClassName="w-[2px]" />}
            {live && (
              <span
                className="ad-live-dot absolute top-0.5 right-2.5 h-2 w-2 rounded-full bg-[#E6392E] ring-2 ring-canvas"
                aria-hidden="true"
              />
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
}
