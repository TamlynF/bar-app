import Image from "next/image";
import { cn } from "@/lib/utils";

/* The venue's map marker: the DF mark in a small olive badge with a thin gold
   ring, its point sitting exactly on the centre of the map it's placed over. */
export function DfMapPin({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-full flex-col items-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)]",
        className
      )}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] border-gold bg-[#26300D]">
        <Image src="/short_logo_transparent.png" alt="" width={20} height={20} className="h-5 w-5" />
      </span>
      <span className="-mt-1 h-2 w-2 rotate-45 border-r-[1.5px] border-b-[1.5px] border-gold bg-[#26300D]" />
    </span>
  );
}
