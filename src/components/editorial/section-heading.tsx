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

export function SectionHeading({
  eyebrow,
  title,
  action,
  id,
  actionOnMobile = true,
}: {
  eyebrow: string;
  title: string;
  action?: { href: string; label: string };
  id?: string;
  /* false = the section renders its own action below the content on phones */
  actionOnMobile?: boolean;
}) {
  return (
    <div
      id={id}
      className="mb-6 flex scroll-mt-24 flex-col items-start gap-3 border-b border-white/10 pb-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between sm:gap-4"
    >
      <div className="min-w-0 max-w-full">
        <span className="mb-2 block text-eyebrow font-semibold text-[#FDCC4B]">
          {eyebrow}
        </span>
        <h2 className="font-black text-[clamp(1.5rem,4.5vw,2.25rem)] leading-[0.95] tracking-tighter text-ink uppercase">
          {title}
        </h2>
      </div>
      {action && (
        <SectionAction href={action.href} className={cn("shrink-0", !actionOnMobile && "hidden sm:inline-flex")}>
          {action.label}
        </SectionAction>
      )}
    </div>
  );
}
