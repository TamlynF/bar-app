import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { SerializedEvent } from "@/lib/events-display";

/* Phone-only: whatever follows the headline act on the featured night, as a
   slim strip under the poster so it stays with that night rather than in
   the Coming up list. */
export function LaterTonightStrip({
  events,
  isTonight,
  dayName,
}: {
  events: SerializedEvent[];
  isTonight: boolean;
  dayName: string;
}) {
  if (events.length === 0) return null;
  const label = isTonight ? "Later tonight" : `Later on ${dayName}`;

  return (
    <section aria-label={label} className="mx-4 mt-3 md:hidden">
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {events.map((e) => (
          <li key={e.id} style={{ "--ev-c": e.color } as React.CSSProperties}>
            <Link
              href={`/whats-on/${e.id}`}
              className="flex min-h-16 items-center gap-3 rounded-[14px] border border-gold/40 bg-gold/8 px-3 py-2 transition-colors active:bg-gold/15"
            >
              <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-[10px] bg-canvas">
                {e.imageUrl ? (
                  <Image src={e.imageUrl} alt="" fill sizes="44px" className="object-cover object-[center_70%]" />
                ) : (
                  <span className="absolute inset-0 bg-linear-to-br from-(--ev-c)/60 to-canvas" aria-hidden="true" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-black text-[9px] tracking-[0.18em] text-gold uppercase">{label}</span>
                <span className="mt-0.5 block truncate font-black text-sm leading-tight tracking-tight text-ink uppercase">
                  {e.title}
                </span>
                <span className="mt-0.5 block truncate text-[12px] text-ink-2 tabular-nums">
                  {[e.startTimeLabel, e.subType].filter(Boolean).join(" · ")}
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
