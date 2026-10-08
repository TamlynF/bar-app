"use client";

import { useEffect, useState } from "react";

const HIDE_AFTER_PX = 12;
const SHOW_NEAR_TOP_PX = 80;

/* True while the reader is scrolling down the page, false as soon as they
   scroll back up or reach the top - the way the phone browser's own bars
   behave, so the site's bars get out of the way at the same moment. */
export function useHideOnScroll(): boolean {
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

  return hidden;
}
