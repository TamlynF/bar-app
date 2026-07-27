import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function SectionHeading({
  eyebrow,
  title,
  action,
  id,
}: {
  eyebrow: string;
  title: string;
  action?: { href: string; label: string };
  id?: string;
}) {
  return (
    <div
      id={id}
      className="mb-6 flex scroll-mt-24 flex-col items-start gap-3 border-b border-white/10 pb-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between sm:gap-4"
    >
      <div className="min-w-0 max-w-full">
        <span className="mb-2 block font-black text-[10px] tracking-[0.3em] text-[#FDCC4B] uppercase sm:text-xs">
          {eyebrow}
        </span>
        <h2 className="font-black text-[clamp(1.5rem,4.5vw,2.25rem)] leading-[0.95] tracking-tighter text-ink uppercase">
          {title}
        </h2>
      </div>
      {action && (
        <Link
          href={action.href}
          className="group inline-flex min-h-11 shrink-0 items-center gap-1.5 font-black text-[10px] tracking-widest text-stone-400 uppercase transition-colors hover:text-white sm:min-h-0 sm:pb-1 sm:text-xs"
        >
          {action.label}
          <ArrowRight
            className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      )}
    </div>
  );
}
