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
      className="mb-6 flex scroll-mt-24 items-end justify-between gap-4 border-b border-white/10 pb-4 sm:mb-8"
    >
      <div className="min-w-0">
        <span className="mb-2 block font-black text-[10px] tracking-[0.3em] text-[#FDCC4B] uppercase sm:text-xs">
          {eyebrow}
        </span>
        <h2 className="font-black text-[clamp(2rem,8vw,4rem)] leading-[0.9] tracking-tighter text-white uppercase">
          {title}
        </h2>
      </div>
      {action && (
        <Link
          href={action.href}
          className="group inline-flex shrink-0 items-center gap-1.5 pb-1 font-black text-[10px] tracking-widest text-stone-400 uppercase transition-colors hover:text-white sm:text-xs"
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
