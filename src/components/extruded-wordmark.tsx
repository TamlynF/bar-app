import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  COMPANY_WORDMARK_HEIGHT,
  COMPANY_WORDMARK_SRC,
  COMPANY_WORDMARK_WIDTH,
} from "@/components/company-wordmark";
import styles from "./extruded-title.module.css";

/* The CompanyName.png wordmark as a 3D block turning a full 360°: darkened
   copies stacked back on Z form the edge, a front face and a back face
   (turned to face outward) keep the logo reading the right way round from
   either side. Uses the ExtrudedTitle stage and slab styles for the
   perspective and depth; the turn itself is .ad-turn in globals.css, which
   stops under prefers-reduced-motion. */
export function ExtrudedWordmark({
  className,
  slabs = 24,
  depth = 1.25,
  priority = false,
}: {
  className?: string;
  slabs?: number;
  depth?: number;
  priority?: boolean;
}) {
  const imageProps = {
    src: COMPANY_WORDMARK_SRC,
    width: COMPANY_WORDMARK_WIDTH,
    height: COMPANY_WORDMARK_HEIGHT,
    quality: 100,
  };

  return (
    <div
      className={cn(styles.stage, className)}
      style={
        {
          "--extrude-depth": `${depth}px`,
          "--extrude-back": `${(slabs + 1) * depth}px`,
        } as React.CSSProperties
      }
    >
      <div className="ad-turn grid transform-3d *:[grid-area:1/1] *:transform-3d">
        <Image
          {...imageProps}
          alt=""
          aria-hidden="true"
          className="h-auto w-full backface-hidden [transform:translateZ(calc(var(--extrude-back)*-1))_rotateY(180deg)]"
        />
        {Array.from({ length: slabs }, (_, i) => (
          <Image
            key={i}
            {...imageProps}
            alt=""
            aria-hidden="true"
            className={cn(styles.slab, "h-auto w-full brightness-[var(--shade)]")}
            style={{ "--i": i + 1, "--shade": 0.55 - (i / slabs) * 0.3 } as React.CSSProperties}
          />
        ))}
        <Image {...imageProps} alt="Don Fenticas" priority={priority} className="h-auto w-full backface-hidden" />
      </div>
    </div>
  );
}
