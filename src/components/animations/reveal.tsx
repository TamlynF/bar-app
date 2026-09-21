import { revealDelay } from "@/lib/motion";
import { cn } from "@/lib/utils";

/* Scroll reveal: opacity 0 and 16px down that resolve as the element
   enters the viewport (driven by RevealOnScroll).
   `index` staggers siblings within a section. Without JavaScript or with
   reduced motion the element simply renders. */
export function Reveal({
  as: Tag = "div",
  index = 0,
  className,
  children,
}: {
  as?: "div" | "section" | "li" | "article";
  index?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Tag data-reveal className={cn(className)} style={revealDelay(index)}>
      {children}
    </Tag>
  );
}
