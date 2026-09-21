import Image from "next/image";
import { ShoppingBag } from "lucide-react";
import type { MerchandiseRow } from "@/components/merchandise-section";
import { formatGBP } from "@/lib/events-display";
import { floatingVariant } from "@/lib/motion";
import { cn } from "@/lib/utils";

export function MerchRail({ merchandise, className }: { merchandise: MerchandiseRow[]; className?: string }) {
  return (
    <div className={cn("relative min-w-0 md:flex-1", className)}>
      <ul className="no-scrollbar -mx-4 mt-3 flex snap-x snap-mandatory list-none gap-2.5 overflow-x-auto scroll-px-4 px-4 pb-1 md:mx-0 md:mt-0 md:gap-4 md:scroll-px-0 md:px-0">
      {merchandise.map((item) => {
        const price = item.price == null ? null : Number(item.price);
        return (
          <li key={item.id} className="ad-float group w-36 shrink-0 snap-start md:w-40" style={floatingVariant(`merch-${item.id}`)}>
            <div className="ad-card-lift relative aspect-square overflow-hidden rounded-xl border border-ink/15 bg-[radial-gradient(70%_60%_at_50%_35%,#2a2f1c,#14180a)] text-ink">
              {item.image_url ? (
                <Image src={item.image_url} alt="" fill sizes="(max-width: 768px) 144px, 160px" className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03] group-active:scale-[1.03]" />
              ) : (
                <ShoppingBag className="absolute top-1/2 left-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2" strokeWidth={1.6} aria-hidden="true" />
              )}
              {price !== null && (
                <span className="absolute top-1.5 right-1.5 animate-[ad-fade-in_1s_ease-in_both] rounded-full bg-gold px-2 py-0.5 text-pill font-bold md:px-1.5 text-on-gold tabular-nums shadow-md shadow-black/40">
                  {formatGBP(price)}
                </span>
              )}
            </div>
            <p className="mt-1.5 line-clamp-2 text-meta font-semibold leading-tight text-ink">{item.name}</p>
          </li>
        );
      })}
      </ul>
      <div
        className="pointer-events-none absolute inset-y-0 -right-4 w-12 bg-linear-to-l from-canvas-2 to-transparent md:hidden"
        aria-hidden="true"
      />
    </div>
  );
}
