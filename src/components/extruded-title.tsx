import { cn } from "@/lib/utils";
import styles from "./extruded-title.module.css";

/**
 * ExtrudedTitle — the act's name as a slowly-turning 3D backdrop.
 *
 * Public surface only. Use it where the *content* is a name that deserves
 * stage treatment (headline act on an event page, tonight's act on the
 * home hero, the band's own name on the Request-to-Play form). Never for
 * the bar's own name — STYLE_GUIDE page-identity rule: the brand lives in
 * the nav, once.
 *
 * Server Component friendly: renders static markup + a CSS module. The
 * sway is a CSS keyframe, disabled under prefers-reduced-motion.
 *
 * Colours default to the public palette (cream face on an olive flank).
 * Pass `face`/`side` to match an event-type badge colour if wanted, but
 * check contrast against #1a2008 first — neon on dark fails easily.
 */

type Variant = "hero" | "compact";

interface ExtrudedTitleProps {
  /** The name to extrude. Long names wrap per word and scale down. */
  text: string;
  /** hero = big + glow + sway (default). compact = card-sized, static. */
  variant?: Variant;
  /** Front face colour. Default: --bar-cream. */
  face?: string;
  /** Flank colour. Default: a lifted olive so it separates from the canvas. */
  side?: string;
  /** Renders as the page H1 (event pages) or a plain div (home hero). */
  as?: "h1" | "h2" | "div";
  className?: string;
}

// Slab count × depth = block thickness: 18 × 4px = 72px, which shows a
// ~25px flank at the ±22° sway. More layers cost paint time on low-end
// Android for no visible gain.
const HERO_SLABS = 18;
const COMPACT_SLABS = 10;

export function ExtrudedTitle({
  text,
  variant = "hero",
  face = "#FFF4CC",
  side = "#3c4a18",
  as: Tag = "h1",
  className,
}: ExtrudedTitleProps) {
  const trimmed = text.trim();
  // Longest word drives the size so nothing overflows at 375px.
  const longest = Math.max(
    4,
    ...trimmed.split(/\s+/).map((w) => w.length)
  );
  const slabs = variant === "hero" ? HERO_SLABS : COMPACT_SLABS;

  return (
    <div
      className={cn(styles.stage, variant === "compact" && styles.compact, className)}
      // Custom properties only — Edge `no-inline-styles` allows these,
      // and the CSS module reads them for size/colour/depth.
      style={
        {
          "--extrude-face": face,
          "--extrude-side": side,
          "--extrude-depth": variant === "hero" ? "4px" : "2px",
          "--extrude-chars": longest,
        } as React.CSSProperties
      }
    >
      {variant === "hero" && <div className={styles.glow} aria-hidden="true" />}

      <div className={styles.rig}>
        {/* Depth slabs first so the DOM order matches paint order. */}
        {Array.from({ length: slabs }, (_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={cn(styles.text, styles.slab)}
            style={{ "--i": i + 1 } as React.CSSProperties}
          >
            {trimmed}
          </span>
        ))}
        {/* The one copy assistive tech and search actually read. */}
        <Tag className={cn(styles.text, styles.face)}>{trimmed}</Tag>
      </div>
    </div>
  );
}
