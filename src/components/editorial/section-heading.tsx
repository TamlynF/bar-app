import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * Oversized editorial section header (awwwards-style): small uppercase eyebrow
 * over a huge fluid display title, with an optional action link on the right
 * and a hairline rule. Used to open every section on the public site.
 */
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
      className="flex items-end justify-between gap-4 border-b border-white/10 pb-4 mb-6 sm:mb-8 scroll-mt-24"
    >
      <div className="min-w-0">
        <span className="block text-[10px] sm:text-xs font-black uppercase tracking-[0.3em] text-[#FDCC4B] mb-2">
          {eyebrow}
        </span>
        <h2 className="text-white font-black uppercase tracking-tighter leading-[0.9] text-[clamp(2rem,8vw,4rem)]">
          {title}
        </h2>
      </div>
      {action && (
        <Link
          href={action.href}
          className="group shrink-0 inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-black uppercase tracking-widest text-stone-400 hover:text-white transition-colors pb-1"
        >
          {action.label}
          <ArrowRight
            className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform"
            aria-hidden="true"
          />
        </Link>
      )}
    </div>
  );
}
