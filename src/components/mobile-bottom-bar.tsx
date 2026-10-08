"use client";

import Link from "next/link";
import { Home, MapPin, Ticket, UtensilsCrossed } from "lucide-react";
import { Waveform } from "@/components/ui/waveform";
import { cn } from "@/lib/utils";
import { useHideOnScroll } from "@/hooks/use-hide-on-scroll";

/* Thumb bar for phones: four slots - Home, Book, Menu and Contact - the
   destinations a guest reaches for at the bar, so the top bar can stay at
   logo, status and a short drawer. Gallery and the drinks market stay in the
   drawer and the live ticker strip; a market slot would be a dead end on
   every night the market is closed.
   Slides away while scrolling down, returns on scroll up or near the top.
   Hidden from `sm` up, where the top nav carries the links. */
export function MobileBottomBar({ currentPath }: { currentPath?: string }) {
  const hidden = useHideOnScroll();

  const items = [
    { href: "/", label: "Home", Icon: Home, active: currentPath === "/" },
    { href: "/book", label: "Book", Icon: Ticket, active: currentPath?.startsWith("/book") ?? false },
    { href: "/menu", label: "Menu", Icon: UtensilsCrossed, active: currentPath?.startsWith("/menu") ?? false },
    { href: "/contact", label: "Contact", Icon: MapPin, active: currentPath === "/contact" },
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
        {items.map(({ href, label, Icon, active }) => (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex min-h-11 min-w-14 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-pill font-semibold whitespace-nowrap transition-colors",
              active ? "text-gold" : "text-ink-2 active:text-ink"
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            {label}
            {active && <Waveform bars={5} className="absolute -bottom-0.5 h-1.5 text-gold" barClassName="w-[2px]" />}
          </Link>
        ))}
      </div>
    </nav>
  );
}
