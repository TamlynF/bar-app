"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronRight, Tag } from "lucide-react";
import { SectionHeading } from "@/components/editorial/section-heading";
import { ExchangeDealCard } from "@/components/home/exchange-deal-card";
import { SpecialDetailModal } from "@/components/special-detail-modal";
import type { SpecialRow } from "@/components/specials-section";
import { useMarketLive } from "@/hooks/use-market-live";
import { plainText } from "@/lib/plain-text";
import { cn } from "@/lib/utils";

const MAX_DEALS = 3;
const DAY_SHORT = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function whenLabel(s: SpecialRow) {
  const days = [...(s.days_of_week ?? [])].sort((a, b) => a - b);
  if (!days.length || days.length >= 7) return "All week";
  if (days.join() === "1,2,3,4,5") return "Weekdays";
  if (["5,6", "5,6,7", "6,7"].includes(days.join())) return "Fri & Sat";
  if (days.length === 1) return `Every ${DAY_SHORT[days[0]]}`;
  return days.map((d) => DAY_SHORT[d]).join(" & ");
}

/* Drink and food deals as tappable strips: photo on the left, when it runs,
   the deal and a line of detail. Alternates burgundy and gold so two deals
   never blur into one block. Tapping opens the special's own popup. */
export function DealsStrip({ specials, className }: { specials: SpecialRow[]; className?: string }) {
  const [open, setOpen] = useState<SpecialRow | null>(null);
  const marketLive = useMarketLive();
  const deals = specials.slice(0, MAX_DEALS);
  if (deals.length === 0 && !marketLive) return null;

  return (
    <section id="specials" aria-labelledby="deals-heading" className={cn("scroll-mt-24", className)}>
      <SectionHeading eyebrow="Good drinks. Better prices." title="Deals on now" id="deals-heading" />

      <ExchangeDealCard className="mb-2.5 sm:hidden" />

      <ul
        className={cn(
          "grid grid-cols-1 gap-2.5 lg:gap-3",
          deals.length === 1 ? "sm:grid-cols-1" : deals.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"
        )}
      >
        {deals.map((s, i) => {
          const gold = i % 2 === 1;
          return (
            <li key={s.id} className="flex">
              <button
                type="button"
                onClick={() => setOpen(s)}
                className={cn(
                  "flex min-h-21 w-full items-stretch text-left transition-transform hover:-translate-y-0.5 sm:min-h-36",
                  gold ? "bg-gold text-on-gold" : "bg-[#7A1F1F] text-ink"
                )}
              >
                <div className="relative w-21 shrink-0 bg-canvas sm:w-32 lg:w-40">
                  {s.image_url ? (
                    <Image src={s.image_url} alt="" fill sizes="160px" className="object-cover" />
                  ) : (
                    <Tag className="absolute inset-0 m-auto h-6 w-6 text-ink-2" aria-hidden="true" />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 lg:px-5 lg:py-4">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className={cn("text-pill font-bold tracking-wide uppercase", gold ? "text-on-gold/80" : "text-ink/85")}>
                      {whenLabel(s)}
                    </span>
                    <span className="font-black text-h3 leading-none tracking-tight uppercase">{s.title}</span>
                    {s.description && <span className={cn("line-clamp-2 text-meta sm:line-clamp-3", gold ? "text-on-gold/90" : "text-ink/90")}>{plainText(s.description)}</span>}
                  </div>
                  <ChevronRight className={cn("h-5 w-5 shrink-0", gold ? "text-[#7A1F1F]" : "text-gold")} aria-hidden="true" />
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {open && <SpecialDetailModal special={open} onClose={() => setOpen(null)} />}
    </section>
  );
}
