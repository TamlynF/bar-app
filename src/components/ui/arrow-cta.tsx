import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button, type buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/* Primary call to action on the public surface, built on the shadcn Button:
   lifts with a deeper shadow on hover, presses to 97%, and the arrow moves
   on its own. Renders a Next link. */
export function ArrowCta({
  href,
  children,
  variant = "gold",
  size = "cta",
  className,
  external = false,
}: {
  href: string;
  children: React.ReactNode;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  className?: string;
  external?: boolean;
}) {
  const inner = (
    <>
      <span>{children}</span>
      <ArrowRight className="ad-cta-arrow" aria-hidden="true" />
    </>
  );
  return (
    <Button asChild variant={variant} size={size} className={cn("ad-cta group", className)}>
      {external ? (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {inner}
        </a>
      ) : (
        <Link href={href}>{inner}</Link>
      )}
    </Button>
  );
}
