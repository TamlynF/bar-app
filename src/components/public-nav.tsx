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
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#1a2008]/85 backdrop-blur-xl border-b border-[#FDCC4B]/10">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-3 sm:px-4 py-2 gap-2 pt-safe-top">
          {/* Logo — square df mark, links home */}
          <Link
            href="/"
            className="shrink-0 inline-flex items-center"
            onClick={() => setMenuOpen(false)}
            aria-label="Don Fenticas — home"
          >
            <Image
              src="/df-mark.jpg"
              alt=""
              width={36}
              height={36}
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-md object-cover"
              priority
            />
          </Link>

          {/* Right cluster */}
          <div className="flex items-center gap-0.5 sm:gap-1.5 shrink-0">
            {/* Primary text links — visible at ALL breakpoints */}
            {primaryLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "inline-flex items-center text-[10px] sm:text-xs font-bold uppercase tracking-tight sm:tracking-wide px-2 sm:px-3 py-1.5 rounded-full transition-colors",
                  currentPath === link.href
                    ? "text-[#FDCC4B] bg-white/5"
                    : "text-stone-400 hover:text-white hover:bg-white/5"
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
                  "hidden sm:inline-flex items-center text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-full transition-colors",
                  currentPath === link.href
                    ? "text-[#FDCC4B] bg-white/5"
                    : "text-stone-500 hover:text-white hover:bg-white/5"
                )}
              >
                {link.label}
              </Link>
            ))}

            {/* Primary CTA — always visible */}
            <Link
              href="/book"
              className="ml-1 bg-[#FDCC4B] text-[#1a2008]! text-[10px] sm:text-xs font-black uppercase tracking-wide px-3 py-1.5 sm:px-4 sm:py-2 rounded-full hover:bg-[#e5b843] transition-colors active:scale-95"
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
                className="sm:hidden inline-flex items-center justify-center w-11 h-11 ml-0.5 rounded-full text-stone-300 hover:text-white hover:bg-white/5 active:scale-95 transition-colors"
              >
                {menuOpen ? <X className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
              </button>
            )}
          </div>
        </div>

        {/* Mobile drawer — secondary links, same look as primary */}
        {menuOpen && secondaryLinks.length > 0 && (
          <div
            id="public-nav-drawer"
            className="sm:hidden border-t border-[#FDCC4B]/10 bg-[#1a2008]/95 backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <div className="max-w-5xl mx-auto px-3 py-2 flex flex-col">
              {secondaryLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "px-3 py-3 rounded-xl text-sm font-bold uppercase tracking-wide transition-colors",
                    currentPath === link.href
                      ? "text-[#FDCC4B] bg-white/5"
                      : "text-stone-400 hover:text-white hover:bg-white/5"
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
      <div className="h-14 sm:h-16 pt-safe-top" aria-hidden="true" />
    </>
  );
}