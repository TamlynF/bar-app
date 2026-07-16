"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Menu as MenuIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Public-site top nav. Used on every public page.
 *
 * Pattern:
 *  - Square `df` mark on the left, links home. Frees ~100px of horizontal
 *    space vs the full "don fenticas" wordmark so the right cluster fits
 *    cleanly at 375px.
 *  - Primary destinations (Menu / Gallery / Contact) visible as text links
 *    at every breakpoint.
 *  - Hamburger drawer holds less-frequent items only (Staff Login, plus any
 *    future items like About / Events / FAQ). On sm+ those items appear
 *    inline beside the primary links and the hamburger is hidden.
 *  - Primary CTA (Book) is the only filled pill — gold, always visible.
 *
 * Per STYLE_GUIDE.md: the brand appears here and ONLY here per page.
 * Sub-pages must not repeat the logo as a hero word.
 */
export function PublicNav({ currentPath }: { currentPath?: string }) {
  const [menuOpen, setMenuOpen] = useState(false);

  // Primary — always visible as text links
  const primaryLinks = [
    { href: "/whats-on", label: "What's On" },
    { href: "/menu", label: "Menu" },
    { href: "/gallery", label: "Gallery" },
    { href: "/contact", label: "Contact" },
  ];

  // Secondary — in hamburger on mobile, inline on sm+
  // Add About / Events / FAQ here as the site grows.
  const secondaryLinks = [
    { href: "/login", label: "Staff Login" },
  ];

  return (
    <>
      <nav className="fixed top-0 right-0 left-0 z-50 border-b border-[#FDCC4B]/10 bg-canvas/85 backdrop-blur-xl">
        <div className="pt-safe-top mx-auto flex max-w-5xl items-center justify-between gap-2 px-3 py-2 sm:px-4">
          {/* Logo — square df mark, links home */}
          <Link
            href="/"
            className="inline-flex shrink-0 items-center"
            onClick={() => setMenuOpen(false)}
            aria-label="Don Fenticas — home"
          >
            <Image
              src="/df-mark.jpg"
              alt=""
              width={36}
              height={36}
              className="h-8 w-8 rounded-md object-cover sm:h-9 sm:w-9"
              priority
            />
          </Link>

          {/* Right cluster */}
          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1.5">
            {/* Primary text links — visible at ALL breakpoints */}
            {primaryLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "inline-flex items-center rounded-full px-1.5 py-1.5 text-[10px] font-bold tracking-tight whitespace-nowrap uppercase transition-colors sm:px-3 sm:text-xs sm:tracking-wide",
                  currentPath === link.href
                    ? "bg-canvas-2 text-[#FDCC4B]"
                    : "text-stone-400 hover:bg-canvas-2 hover:text-ink"
                )}
              >
                {link.label}
              </Link>
            ))}

            {/* Secondary links — inline on sm+ only */}
            {secondaryLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "hidden items-center rounded-full px-3 py-1.5 text-xs font-bold tracking-wide uppercase transition-colors sm:inline-flex",
                  currentPath === link.href
                    ? "bg-canvas-2 text-[#FDCC4B]"
                    : "text-stone-500 hover:bg-canvas-2 hover:text-ink"
                )}
              >
                {link.label}
              </Link>
            ))}

            {/* Primary CTA — always visible */}
            <Link
              href="/book"
              className="ml-1 rounded-full bg-[#FDCC4B] px-3 py-1.5 font-black text-[10px] tracking-wide text-[#1a2008]! uppercase transition-colors hover:bg-[#e5b843] active:scale-95 sm:px-4 sm:py-2 sm:text-xs"
            >
              Book
            </Link>

            {/* Hamburger — mobile only, only renders if secondary items exist */}
            {secondaryLinks.length > 0 && (
              <button
                type="button"
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                aria-expanded={menuOpen}
                aria-controls="public-nav-drawer"
                onClick={() => setMenuOpen((o) => !o)}
                className="ml-0.5 inline-flex h-11 w-11 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-canvas-2 hover:text-ink active:scale-95 sm:hidden"
              >
                {menuOpen ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
              </button>
            )}
          </div>
        </div>

        {/* Mobile drawer — secondary links, same look as primary */}
        {menuOpen && secondaryLinks.length > 0 && (
          <div
            id="public-nav-drawer"
            className="animate-in border-t border-[#FDCC4B]/10 bg-canvas/95 backdrop-blur-xl duration-200 fade-in slide-in-from-top-2 sm:hidden"
          >
            <div className="mx-auto flex max-w-5xl flex-col px-3 py-2">
              {secondaryLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "rounded-xl px-3 py-3 text-sm font-bold tracking-wide uppercase transition-colors",
                    currentPath === link.href
                      ? "bg-canvas-2 text-[#FDCC4B]"
                      : "text-stone-400 hover:bg-canvas-2 hover:text-ink"
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Spacer so content doesn't sit under the fixed nav (includes safe-area-inset-top) */}
      <div className="pt-safe-top h-14 sm:h-16" aria-hidden="true" />
    </>
  );
}