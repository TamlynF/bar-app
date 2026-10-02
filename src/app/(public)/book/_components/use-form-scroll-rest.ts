"use client";

import { useEffect } from "react";

const SETTLE_MS = 120;
const KEYBOARD_CLOSE_MS = 450;
const KEYBOARD_GAP = 16;

function editingField(): HTMLElement | null {
  const el = document.activeElement;
  return el instanceof HTMLElement && el.matches("input, textarea, select, [contenteditable='true']") ? el : null;
}

/* Measured against the layout viewport (clientHeight), which keeps its full
   height while the iPhone keyboard is open; innerHeight and the visual
   viewport shrink with the keyboard and would say the form no longer fits. */
function pageFitsScreen() {
  const root = document.documentElement;
  return root.scrollHeight <= root.clientHeight + 1;
}

function toTop() {
  window.scrollTo({ top: 0, behavior: "instant" });
}

/* Back to the top of the page with no animation, used on Next and Back. The
   keyboard is usually still closing at that moment and Safari moves the page
   again as it goes, so the jump is repeated once the keyboard has gone. A form
   that fits the screen then sits centred; a longer one shows its top edge
   clear of the nav. */
export function scrollFormToRest() {
  editingField()?.blur();
  requestAnimationFrame(toTop);
  const vv = window.visualViewport;
  const done = () => {
    vv?.removeEventListener("resize", done);
    clearTimeout(fallback);
    toTop();
  };
  const fallback = setTimeout(done, KEYBOARD_CLOSE_MS);
  vv?.addEventListener("resize", done);
}

/* Safari lifts the page to keep the tapped field above the keyboard and leaves
   it lifted after the keyboard closes. On a form that fits the screen:
   - while a field is being edited, the page stays at rest whenever that field
     is still fully visible above the keyboard there;
   - once nothing is being edited, the page settles back to rest. */
export function useFormScrollRest() {
  useEffect(() => {
    const vv = window.visualViewport;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const settle = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (window.scrollY === 0 || !pageFitsScreen()) return;
        const field = editingField();
        if (!field) {
          toTop();
          return;
        }
        const bottomAtRest = field.getBoundingClientRect().bottom + window.scrollY;
        const visibleHeight = vv?.height ?? window.innerHeight;
        if (bottomAtRest + KEYBOARD_GAP <= visibleHeight) toTop();
      }, SETTLE_MS);
    };

    document.addEventListener("focusin", settle);
    document.addEventListener("focusout", settle);
    window.addEventListener("scroll", settle, { passive: true });
    vv?.addEventListener("resize", settle);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("focusin", settle);
      document.removeEventListener("focusout", settle);
      window.removeEventListener("scroll", settle);
      vv?.removeEventListener("resize", settle);
    };
  }, []);
}
