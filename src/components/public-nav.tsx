"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { LogIn, Menu as MenuIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function PublicNav({
  currentPath,
  transparentAtTop = false,
}: {
  currentPath?: string;
  transparentAtTop?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!transparentAtTop) return;
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [transparentAtTop]);

  const solid = !transparentAtTop || scrolled || menuOpen;

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
          "fixed top-0 right-0 left-0 z-50 border-b transition-colors duration-300",
          solid
            ? "border-[#FDCC4B]/10 bg-canvas/85 backdrop-blur-xl"
            : "border-transparent bg-transparent"
        )}
      >
        <div className="pt-safe-top mx-auto grid h-14 max-w-5xl grid-cols-[1fr_auto_1fr] items-center px-3 sm:h-16 sm:px-4">
          <Link
            href="/"
            className="inline-flex w-fit items-center justify-self-start"
            onClick={() => setMenuOpen(false)}
            aria-label="Don Fenticas — home"
          >
            <Image
              src="/CompanyName.png"
              alt=""
              width={869}
              height={176}
              className="h-7 w-auto object-contain sm:h-8"
              priority
            />
          </Link>

          <div className="hidden items-center gap-1.5 justify-self-center sm:flex">
            {primaryLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "inline-flex items-center rounded-full px-3 py-1.5 text-xs font-bold tracking-wide whitespace-nowrap uppercase transition-colors",
                  currentPath === link.href
                    ? "bg-canvas-2 text-[#FDCC4B]"
                    : "text-stone-400 hover:bg-canvas-2 hover:text-ink"
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-1 justify-self-end sm:gap-1.5">
            <Link
              href="/login"
              aria-label="Staff login"
              className={cn(
                "hidden h-9 w-9 items-center justify-center rounded-full transition-colors sm:inline-flex",
                currentPath === "/login"
                  ? "bg-canvas-2 text-[#FDCC4B]"
                  : "text-stone-500 hover:bg-canvas-2 hover:text-ink"
              )}
            >
              <LogIn className="h-4 w-4" />
            </Link>

            <Link
              href="/book"
              className="rounded-full bg-[#FDCC4B] px-3.5 py-2 font-black text-[11px] tracking-wide text-[#1a2008]! uppercase transition-colors hover:bg-[#e5b843] active:scale-95 sm:px-4 sm:text-xs"
            >
              Book
            </Link>

            <button
              type="button"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="public-nav-drawer"
              onClick={() => setMenuOpen((o) => !o)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-canvas-2 hover:text-ink active:scale-95 sm:hidden"
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
            <div className="mx-auto flex max-w-5xl flex-col px-3 py-2">
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

      {!transparentAtTop && <div className="h-14 sm:h-16" aria-hidden="true" />}
    </>
  );
}