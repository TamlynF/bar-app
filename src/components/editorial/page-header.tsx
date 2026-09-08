import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  tone = "gold",
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  /* "live" swaps the gold eyebrow for the neon "happening now" treatment */
  tone?: "gold" | "live";
  children?: ReactNode;
}) {
  return (
    <div className="mb-8 sm:mb-14">
      <span
        className={cn(
          "mb-3 flex items-center gap-2 font-black text-[10px] tracking-[0.3em] uppercase sm:text-xs",
          tone === "live" ? "text-[#FF6B35]" : "text-[#FDCC4B]"
        )}
      >
        {tone === "live" && (
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FF6B35] opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#FF6B35]" />
          </span>
        )}
        {eyebrow}
      </span>
      <h1 className="m-0 max-w-3xl font-black text-[clamp(2rem,8vw,3rem)] leading-[0.92] tracking-tighter text-ink uppercase">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone-400 sm:mt-4">
          {subtitle}
        </p>
      )}
      {children}
    </div>
  );
}
