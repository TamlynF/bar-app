"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronsUp } from "lucide-react";

/* Mobile scrolls the window; from the sm breakpoint up the admin shell scrolls an
   inner div, so every jump has to be aimed at whichever one is live. */
function findScrollContainer(): HTMLElement | null {
  let node = document.querySelector<HTMLElement>("[data-category-section]")?.parentElement ?? null;
  while (node) {
    const overflowY = getComputedStyle(node).overflowY;
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

export default function JumpToTopButton() {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [atCategoryTop, setAtCategoryTop] = useState(false);

  useEffect(() => {
    const sync = () => setContainer(findScrollContainer());
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  const anchorOffset = () =>
    (document.querySelector("header")?.getBoundingClientRect().height ?? 0) + 8;

  const currentSection = useCallback(() => {
    const sections = [...document.querySelectorAll<HTMLElement>("[data-category-section]")];
    const anchor = anchorOffset();
    return sections.filter((section) => section.getBoundingClientRect().top - anchor <= 2).pop() ?? null;
  }, []);

  useEffect(() => {
    const target: HTMLElement | Window = container ?? window;
    const update = () => {
      setVisible((container ? container.scrollTop : window.scrollY) > 240);
      const section = currentSection();
      setAtCategoryTop(!!section && section.getBoundingClientRect().top - anchorOffset() > -4);
    };
    update();
    target.addEventListener("scroll", update, { passive: true });
    return () => target.removeEventListener("scroll", update);
  }, [container, currentSection]);

  const handleJump = () => {
    const scrollToTop = () =>
      container
        ? container.scrollTo({ top: 0, behavior: "smooth" })
        : window.scrollTo({ top: 0, behavior: "smooth" });

    const section = currentSection();
    if (!section) {
      scrollToTop();
      return;
    }

    const delta = section.getBoundingClientRect().top - anchorOffset();
    if (delta > -4) {
      scrollToTop();
      return;
    }

    if (container) container.scrollTo({ top: container.scrollTop + delta, behavior: "smooth" });
    else window.scrollBy({ top: delta, behavior: "smooth" });
  };

  if (!visible) return null;

  const label = atCategoryTop ? "Back to the top of the page" : "Jump to the top of this category";

  return (
    <button
      type="button"
      onClick={handleJump}
      aria-label={label}
      title={label}
      className="fixed right-4 bottom-24 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-admin-line bg-admin-card text-admin-primary shadow-sm transition-colors hover:bg-admin-primary-soft active:scale-[0.98] sm:right-8 sm:bottom-8"
    >
      <ChevronsUp className="h-5 w-5" />
    </button>
  );
}
