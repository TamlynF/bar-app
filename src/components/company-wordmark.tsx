import Image from "next/image";
import { cn } from "@/lib/utils";

export const COMPANY_WORDMARK_SRC = "/CompanyName.png";
export const COMPANY_WORDMARK_WIDTH = 869;
export const COMPANY_WORDMARK_HEIGHT = 176;

export function CompanyWordmark({
  className,
  decorative = false,
  priority = false,
}: {
  className?: string;
  decorative?: boolean;
  priority?: boolean;
}) {
  return (
    <Image
      src={COMPANY_WORDMARK_SRC}
      alt={decorative ? "" : "Don Fenticas"}
      width={COMPANY_WORDMARK_WIDTH}
      height={COMPANY_WORDMARK_HEIGHT}
      quality={100}
      priority={priority}
      className={cn("h-auto w-auto max-w-full object-contain", className)}
    />
  );
}
