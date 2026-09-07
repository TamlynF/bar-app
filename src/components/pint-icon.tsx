import { cn } from "@/lib/utils";

/* Pint glass for the drinks-market button. Upright with a gently sloshing
   head and rising bubbles when idle; tilts and pours when `pouring`. Pure SVG
   + CSS (see .ad-pint-* in globals.css), colours from currentColor. */
export function PintIcon({ pouring = false, className }: { pouring?: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("ad-pint h-6 w-6 overflow-visible", pouring && "ad-pint-pouring", className)}
      aria-hidden="true"
      fill="none"
    >
      <defs>
        <clipPath id="ad-pint-clip">
          {/* inside of the glass */}
          <path d="M10.5 9.5 H21.5 L20.6 26.5 H11.4 Z" />
        </clipPath>
      </defs>

      {/* the glass, tilts as one */}
      <g className="ad-pint-glass">
        {/* liquid */}
        <g clipPath="url(#ad-pint-clip)">
          <rect className="ad-pint-liquid" x="8" y="13" width="16" height="16" fill="currentColor" opacity="0.55" />
          {/* head - a wavy cap that slides side to side */}
          <path
            className="ad-pint-head"
            d="M6 13.4 C8 12.2, 10 12.2, 12 13.4 S16 14.6, 18 13.4 S22 12.2, 24 13.4 S28 14.6, 30 13.4 V15.4 H6 Z"
            fill="currentColor"
            opacity="0.95"
          />
          {/* bubbles */}
          <circle className="ad-pint-bubble ad-pint-bubble-1" cx="13.5" cy="24" r="0.9" fill="currentColor" opacity="0.9" />
          <circle className="ad-pint-bubble ad-pint-bubble-2" cx="17.5" cy="25.5" r="0.7" fill="currentColor" opacity="0.9" />
          <circle className="ad-pint-bubble ad-pint-bubble-3" cx="15.6" cy="23" r="0.6" fill="currentColor" opacity="0.9" />
        </g>
        {/* outline */}
        <path
          d="M9.5 7.5 H22.5 L21.4 27.2 A1.5 1.5 0 0 1 19.9 28.5 H12.1 A1.5 1.5 0 0 1 10.6 27.2 Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        {/* handle */}
        <path d="M22.3 12 H24.4 A2.6 2.6 0 0 1 27 14.6 V18.4 A2.6 2.6 0 0 1 24.4 21 H21.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </g>
      {/* pour stream + splash (only while pouring) - on top of the glass, from the tipped rim */}
      <g className="ad-pint-stream" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path className="ad-pint-stream-line" d="M6.2 12.5 C5 15.5, 4.4 19, 4.2 24.5" />
        <circle className="ad-pint-drop ad-pint-drop-1" cx="4.6" cy="27.4" r="0.9" fill="currentColor" stroke="none" />
        <circle className="ad-pint-drop ad-pint-drop-2" cx="2.4" cy="26.4" r="0.7" fill="currentColor" stroke="none" />
      </g>
    </svg>
  );
}
