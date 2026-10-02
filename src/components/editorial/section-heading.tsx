import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ArrowCta } from "@/components/ui/arrow-cta";
import { cn } from "@/lib/utils";

/* The one link that sits at the top-right of a public section header
   ("Full schedule", "Open the market"). Every section uses this so they
   all match; on phones a section renders it full-width under the content
   instead (variant goldOutline, className w-full). */
export function SectionAction({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <ArrowCta href={href} variant="goldOutline" size="sm" className={cn("rounded-full", className)}>
      {children}
    </ArrowCta>
  );
}

/* The phone form of a section action when it sits beside the title: cream
   text and an arrow, so it reads as a link rather than as another gold
   label next to the eyebrow. */
export function SectionTextAction({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex min-h-11 shrink-0 items-center text-btn font-semibold text-ink transition-colors hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
        className
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        {children}
        <ArrowRight
          className="size-4 transition-transform motion-safe:group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </span>
    </Link>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  action,
  id,
  actionOnMobile = true,
  actionInline = false,
}: {
  eyebrow?: string;
  title: string;
  action?: { href: string; label: string };
  id?: string;
  /* false = the section renders its own action below the content on phones */
  actionOnMobile?: boolean;
  /* true = on phones the action sits beside the title as a text link */
  actionInline?: boolean;
}) {
  return (
    <div
      id={id}
      className={cn(
        "mb-6 flex scroll-mt-24 flex-col items-start gap-3 border-b border-white/10 pb-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between sm:gap-4",
        actionInline && "flex-row items-end justify-between"
      )}
    >
      <div className="min-w-0 max-w-full">
        {eyebrow && (
          <span className="mb-2 block text-eyebrow font-semibold text-[#FDCC4B]">
            {eyebrow}
          </span>
        )}
        <h2 className="font-black text-[clamp(1.5rem,4.5vw,2.25rem)] leading-[0.95] tracking-tighter text-ink uppercase">
          {title}
        </h2>
      </div>
      {action && actionInline && (
        <SectionTextAction href={action.href} className="-mb-3 sm:hidden">
          {action.label}
        </SectionTextAction>
      )}
      {action && (
        <SectionAction
          href={action.href}
          className={cn("shrink-0", (!actionOnMobile || actionInline) && "hidden sm:inline-flex")}
        >
          {action.label}
        </SectionAction>
      )}
    </div>
  );
}
