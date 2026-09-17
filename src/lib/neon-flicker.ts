const GLOW_ON = "0 0 18px 2px rgba(253,204,75,0.9), 0 0 40px 8px rgba(253,204,75,0.35)";
const GLOW_PEAK = "0 0 22px 3px rgba(253,204,75,0.95), 0 0 48px 10px rgba(253,204,75,0.4)";
const GLOW_DIM = "0 0 3px 0 rgba(253,204,75,0.2)";
const GLOW_OFF = "0 0 0 0 rgba(253,204,75,0)";

export function neonFlicker(e: { target: EventTarget | null }) {
  if (typeof window === "undefined") return;
  const el = (e.target as HTMLElement | null)?.closest?.<HTMLElement>("a,button");
  if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  el.animate(
    [
      { boxShadow: GLOW_OFF, offset: 0 },
      { boxShadow: GLOW_ON, offset: 0.1 },
      { boxShadow: GLOW_DIM, offset: 0.2 },
      { boxShadow: GLOW_ON, offset: 0.3 },
      { boxShadow: GLOW_DIM, offset: 0.45 },
      { boxShadow: GLOW_PEAK, offset: 0.6 },
      { boxShadow: GLOW_OFF, offset: 1 },
    ],
    { duration: 480, easing: "steps(1, end)" }
  );
}
