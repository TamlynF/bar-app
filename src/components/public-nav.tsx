"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { LogIn, Menu as MenuIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function PublicNav({
  currentPath,
  overlay = false,
}: {
  currentPath?: string;
  overlay?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

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
    { href: "/gallery", label: "Gallery" },
    { href: "/contact", label: "Contact" },
  ];

  const mobileLinks = [
    { href: "/", label: "Home" },
    ...primaryLinks,
    { href: "/login", label: "Staff Login" },
  ];

  return (
    <>
      <nav
        className={cn(
          "fixed top-0 right-0 left-0 z-50 border-b transition-[background-color,border-color,backdrop-filter] duration-350",
          solid
            ? "border-[#FDCC4B]/10 bg-canvas/88 backdrop-blur-xl"
            : "border-transparent bg-transparent"
        )}
      >
        <div className="pt-safe-top mx-auto flex h-14 w-full max-w-300 items-center justify-between gap-6 px-4 sm:h-16 sm:px-6">
          <Link
            href="/"
            className="inline-flex w-fit shrink-0 items-center"
            onClick={() => setMenuOpen(false)}
            aria-label="Don Fenticas — home"
          >
            <Image
              src="/CompanyName.png"
              alt=""
              width={869}
              height={176}
              className={cn(
                "h-10 w-auto object-contain sm:h-12",
                !solid && "drop-shadow-[0_2px_14px_rgba(0,0,0,0.75)]"
              )}
              priority
            />
          </Link>

          <div className="hidden items-center gap-7 sm:flex lg:gap-9">
            {primaryLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "inline-flex items-center py-2 text-[11px] font-bold tracking-[0.14em] whitespace-nowrap uppercase transition-colors lg:text-xs",
                  currentPath === link.href ? "text-[#FDCC4B]" : "hover:text-ink",
                  currentPath !== link.href && (solid ? "text-stone-400" : "text-ink"),
                  !solid && "drop-shadow-[0_1px_10px_rgba(0,0,0,0.9)]"
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Link
              href="/login"
              aria-label="Staff login"
              className={cn(
                "hidden h-9 w-9 items-center justify-center rounded-full transition-colors sm:inline-flex",
                currentPath === "/login"
                  ? "bg-canvas-2 text-[#FDCC4B]"
                  : cn(
                      "hover:bg-canvas-2 hover:text-ink",
                      solid
                        ? "text-stone-500"
                        : "text-ink drop-shadow-[0_1px_10px_rgba(0,0,0,0.9)]"
                    )
              )}
            >
              <LogIn className="h-4 w-4" />
            </Link>

            <Link
              href="/book"
              className="hidden rounded-full bg-[#FDCC4B] px-4 py-2 font-black text-xs tracking-wide text-[#1a2008]! uppercase transition-colors hover:bg-[#e5b843] active:scale-95 sm:inline-flex lg:px-5 lg:text-sm"
            >
              Book
            </Link>

            <button
              type="button"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="public-nav-drawer"
              onClick={() => setMenuOpen((o) => !o)}
              className={cn(
                "inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-canvas-2 hover:text-ink active:scale-95 sm:hidden",
                solid
                  ? "text-ink-2"
                  : "text-ink drop-shadow-[0_1px_10px_rgba(0,0,0,0.9)]"
              )}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div
            id="public-nav-drawer"
            className="animate-in border-t border-[#FDCC4B]/10 bg-canvas/95 backdrop-blur-xl duration-200 fade-in slide-in-from-top-2 sm:hidden"
          >
            <div className="mx-auto flex w-full max-w-300 flex-col px-4 py-3">
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

      {!overlay && <div className="h-14 sm:h-16" aria-hidden="true" />}
    </>
  );
}