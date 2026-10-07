"use client";

import { useId, useState, type ReactNode } from "react";
import { HeroActions, type KaraokeTonight } from "@/components/home/hero-actions";

/* The phone hero's wordmark and tagline. Tapping the tagline folds the two
   action buttons under it away and back, so the room photo can be seen
   on its own. */
export function HeroStatement({ karaokeTonight, children }: { karaokeTonight: KaraokeTonight | null; children: ReactNode }) {
  const [showActions, setShowActions] = useState(false);
  const actionsId = useId();

  return (
    <>
      <hgroup className="@container flex flex-col gap-3 sm:hidden">
        {children}
        <p className="px-[4%] text-center text-[4.43cqw] leading-none font-semibold tracking-[0.2em] whitespace-nowrap text-ink uppercase [text-shadow:1px_1px_0_#5a6b26,2px_2px_0_#4a5a1e,3px_3px_0_#3c4a18,4px_4px_10px_rgb(0_0_0/0.6)]">
          <button
            type="button"
            aria-expanded={showActions}
            aria-controls={actionsId}
            onClick={() => setShowActions((open) => !open)}
            className="-my-3.5 cursor-pointer py-3.5 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
          >
            Hinckley’s live music venue
          </button>
        </p>
      </hgroup>
      {showActions ? <HeroActions id={actionsId} karaokeTonight={karaokeTonight} className="mt-1.5 sm:hidden" /> : null}
    </>
  );
}
