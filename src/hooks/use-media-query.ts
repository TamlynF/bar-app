"use client";

import { useEffect, useState } from "react";

/**
 * Tracks a CSS media query on the client. Returns `false` during SSR and the
 * first client render (so markup matches the server), then updates after mount
 * and on viewport changes. Used to choose the booking-detail placement —
 * inline two-pane on desktop vs bottom sheet on mobile.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
