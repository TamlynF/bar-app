import { VinylSpinner } from "@/components/vinyl-spinner";
import { cn } from "@/lib/utils";

function Block({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl bg-white/6", className)} aria-hidden="true">
      <span className="ad-shimmer pointer-events-none absolute inset-0 opacity-25" />
    </div>
  );
}

/* Streaming fallback for the home page: the poster, ticker line and a row
   of cards blocked out with a shimmer, and a record spinning where the act
   will be. */
export function HomeSkeleton() {
  return (
    <div className="mx-auto w-full max-w-400 pt-14 sm:pt-16" aria-busy="true">
      <div className="mx-2 sm:mx-6 lg:mx-10">
        <div className="relative h-[clamp(27rem,66svh,38rem)] overflow-hidden rounded-2xl bg-white/6 md:h-205">
          <span className="ad-shimmer pointer-events-none absolute inset-0 opacity-25" aria-hidden="true" />
          <div className="absolute inset-0 flex items-center justify-center">
            <VinylSpinner />
          </div>
          <div className="absolute right-3 bottom-4 left-3 flex flex-col gap-2.5 md:right-auto md:bottom-16 md:left-10 md:w-[60%]">
            <Block className="h-6 w-28 rounded-full" />
            <Block className="h-14 w-[85%] md:h-20" />
            <Block className="h-14 w-[60%] md:h-20" />
            <Block className="h-4 w-40" />
            <Block className="mt-1 h-12 w-full md:h-14 md:w-52" />
          </div>
        </div>
      </div>
      <div className="mx-4 mt-3 sm:mx-6 lg:mx-10">
        <Block className="h-11 w-full rounded-[14px]" />
      </div>
      <div className="mt-8 px-4 sm:px-6 lg:px-10">
        <Block className="h-6 w-32" />
        <div className="mt-3 flex gap-3 overflow-hidden">
          {Array.from({ length: 3 }, (_, i) => (
            <Block key={i} className="aspect-[3/4] w-38 shrink-0 md:w-72" />
          ))}
        </div>
      </div>
    </div>
  );
}
