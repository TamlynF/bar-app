import Image from "next/image";
import { cn } from "@/lib/utils";

/* The DF mark turning on the spot. Pass a label when it is the only loading
   cue on screen so assistive tech announces it; leave it off when sitting
   next to text that already says what is happening. */
export function DfSpinner({ className, label }: { className?: string; label?: string }) {
  const image = (
    <Image
      src="/df-mark.jpg"
      alt=""
      aria-hidden="true"
      width={96}
      height={96}
      className={cn("animate-spin rounded-full object-cover animation-duration-[1.6s]", className)}
    />
  );

  if (!label) return image;

  return (
    <span role="status" aria-label={label} className="inline-flex">
      {image}
    </span>
  );
}
