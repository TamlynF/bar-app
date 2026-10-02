"use client";

import { useEffect } from "react";

const SETTLE_MS = 150;

function editingField() {
  return !!document.activeElement?.matches("input, textarea, select, [contenteditable='true']");
}

function pageFitsScreen() {
  return document.documentElement.scrollHeight <= window.innerHeight + 1;
}

/* Back to the top of the page with no animation: a smooth scroll started while
   the iPhone keyboard is still closing gets cancelled part way. On a form that
   fits the screen the top is the centred resting position; on a longer one it
   is the form's top edge, clear of the nav. */
export function scrollFormToRest() {
  if (editingField()) (document.activeElement as HTMLElement).blur();
  requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "instant" }));
}

/* Safari lifts the page to keep the tapped field above the keyboard and leaves
   it there once the keyboard closes. When no field is being edited any more
   and the whole form fits the screen, settle it back where it started. */
export function useFormScrollRest() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!editingField() && window.scrollY > 0 && pageFitsScreen()) {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      }, SETTLE_MS);
    };
    document.addEventListener("focusout", settle);
    window.visualViewport?.addEventListener("resize", settle);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("focusout", settle);
      window.visualViewport?.removeEventListener("resize", settle);
    };
  }, []);
}
