import { useId } from "react";
import { cn } from "@/lib/utils";

/* Beer mug for the drinks-market button: handle on the left, amber beer,
   a foam head spilling over the rim, bubbles rising. Upright when idle; tips
   to the right when `pouring` (see .ad-pint-* in globals.css). */
export function PintIcon({ pouring = false, className }: { pouring?: boolean; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 36 36"
      className={cn("ad-pint h-6 w-6 overflow-visible", pouring && "ad-pint-pouring", className)}
      aria-hidden="true"
      fill="none"
    >
      <defs>
        <linearGradient id={`${id}-beer`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F7B733" />
          <stop offset="0.6" stopColor="#E3891A" />
          <stop offset="1" stopColor="#A8520B" />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.18" />
          <stop offset="0.6" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.5" />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <path d="M29 12 H11 V30.5 Q11 33 13.5 33 H26.5 Q29 33 29 30.5 Z" />
        </clipPath>
      </defs>

      <g className="ad-pint-glass">
        {/* handle */}
        <path d="M11 16 H7.5 Q3.5 16 3.5 20 V26 Q3.5 30 7.5 30 H11" stroke="#1a2008" strokeWidth="4.2" strokeLinecap="round" />
        <path d="M11 16 H7.5 Q3.5 16 3.5 20 V26 Q3.5 30 7.5 30 H11" stroke="#FFF1CC" strokeWidth="1.8" strokeLinecap="round" />

        {/* beer + head, inside the glass */}
        <g clipPath={`url(#${id}-clip)`}>
          <g className="ad-pint-liquid">
          <rect x="6" y="10" width="26" height="26" fill={`url(#${id}-beer)`} />
          <rect x="22.9" y="10" width="2.6" height="26" fill="#ffffff" opacity="0.22" />
          <rect x="17.4" y="10" width="1.6" height="26" fill="#ffffff" opacity="0.12" />
          <circle className="ad-pint-bubble ad-pint-bubble-1" cx="24" cy="28" r="1.1" fill="#FFE6A6" opacity="0.9" />
          <circle className="ad-pint-bubble ad-pint-bubble-2" cx="16.5" cy="30" r="0.9" fill="#FFE6A6" opacity="0.9" />
          <circle className="ad-pint-bubble ad-pint-bubble-3" cx="20" cy="26" r="0.7" fill="#FFE6A6" opacity="0.9" />
          <path
            className="ad-pint-head"
            d="M2 15 C4.5 13, 7.5 13, 10 15 S15.5 17, 18 15 S23.5 13, 26 15 S31.5 17, 34 15 V-4 H2 Z"
            fill="#FFF4DA"
          />
          </g>
        </g>

        {/* glass */}
        <path d="M29 12 H11 V30.5 Q11 33 13.5 33 H26.5 Q29 33 29 30.5 Z" fill={`url(#${id}-shine)`} />
        <path d="M29 12 H11 V30.5 Q11 33 13.5 33 H26.5 Q29 33 29 30.5 Z" stroke="#1a2008" strokeWidth="1.7" strokeLinejoin="round" />

        {/* foam over the rim */}
        <path
          d="M30.8 12 C30.8 8.6, 28.6 7.2, 26.4 8.4 C25.6 5.2, 21.6 4.4, 19.8 6.8 C18 3.6, 13 4.2, 12.6 8 C9.8 7, 7.6 9.2, 8.8 12.2 Z"
          fill="#FFF4DA"
          stroke="#1a2008"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M27.8 12.4 c.4 2.6 .1 4.2 -1 4.2 s-1.6 -1.4 -1.4 -4.2" fill="#FFF4DA" stroke="#1a2008" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M13.2 12.4 c-.6 2.2 -1.4 3.2 -2.2 3 s-.6 -1.6 -.1 -3" fill="#FFF4DA" stroke="#1a2008" strokeWidth="1.2" strokeLinejoin="round" />
        <ellipse cx="23.5" cy="8.4" rx="2" ry="1" fill="#ffffff" opacity="0.7" />
      </g>
    </svg>
  );
}
