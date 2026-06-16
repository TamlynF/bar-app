"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Mounts Lenis smooth-scroll for the public site (an awwwards-style buttery
 * scroll feel). Renders nothing. Respects prefers-reduced-motion — when the
 * user asks for reduced motion we skip Lenis entirely and leave native scroll.
 *
 * Mounted in (public)/layout.tsx (covers /book, /menu, /gallery, /contact,
 * /whats-on) and directly in the home page (which lives outside the (public)
 * route group). Deliberately NOT mounted in the root layout so the admin
 * portal keeps native scrolling.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    // anchors: true lets in-page #hash links (the home sticky sub-nav) scroll smoothly.
    const lenis = new Lenis({ anchors: true });
    let rafId = 0;

    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  return null;
}
