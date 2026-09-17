"use client";

import { useEffect } from "react";

/* Marks `[data-reveal]` elements visible as they scroll into view. The
   hidden state only applies once `ad-reveal-ready` is on <html>, so without
   JavaScript (or with reduced motion) everything simply renders. */
export function RevealOnScroll() {
  useEffect(() => {
    if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;
    root.classList.add("ad-reveal-ready");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    document.querySelectorAll("[data-reveal]").forEach((el) => observer.observe(el));
    return () => {
      observer.disconnect();
      root.classList.remove("ad-reveal-ready");
    };
  }, []);
  return null;
}
