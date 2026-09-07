"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, Sparkles, UtensilsCrossed } from "lucide-react";
import { SiInstagram } from "react-icons/si";
import { cn } from "@/lib/utils";

const HIDE_AFTER_PX = 12;
const SHOW_NEAR_TOP_PX = 80;

/* Phone-only thumb bar: the four things someone standing outside the bar or
   on the sofa actually wants. Slides away while scrolling down, returns on
   scroll up or near the top. Hidden from `sm` up (the top nav does the job). */
export function MobileBottomBar({
  currentPath,
  instagramUrl,
}: {
  currentPath?: string;
  instagramUrl: string | null;
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
    { href: "/#tonight", label: "Tonight", Icon: Sparkles, active: currentPath === "/" },
    { href: "/book", label: "Book", Icon: CalendarDays, active: currentPath?.startsWith("/book") ?? false },
    { href: "/menu", label: "Menu", Icon: UtensilsCrossed, active: currentPath === "/menu" },
  ];

  return (
    <nav
      aria-label="Quick actions"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 transition-transform duration-300 ease-out sm:hidden",
        hidden && "translate-y-full"
      )}
    >
      <div className="mx-auto flex items-stretch justify-around border-t border-white/10 bg-canvas/92 px-2 pt-1.5 pb-[calc(env(safe-area-inset-bottom)+0.375rem)] backdrop-blur-xl">
        {items.map(({ href, label, Icon, active }) => (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-w-16 flex-col items-center gap-1 rounded-xl px-3 py-1.5 font-black text-[10px] tracking-[0.14em] uppercase transition-colors",
              active ? "text-gold" : "text-ink-2 active:text-ink"
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            {label}
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
