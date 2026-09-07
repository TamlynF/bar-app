import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ChevronRight } from "lucide-react";
import type { SerializedEvent } from "@/lib/events-display";

/* Phone-only: every other event on the featured night, right under the
   poster, so a second act is never hidden inside the hero. */
export function AlsoOnList({
  events,
  when,
}: {
  events: SerializedEvent[];
  when: string;
}) {
  if (events.length === 0) return null;

  return (
    <section aria-label={`Also on ${when}`} className="mx-4 overflow-hidden rounded-[14px] border border-gold/35 bg-gold/6 md:hidden">
      <div className="flex items-center justify-between gap-2.5 border-b border-gold/20 px-3.5 py-2.5">
        <span className="inline-flex items-center gap-2 font-black text-[10px] tracking-[0.22em] text-gold uppercase">
          <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
          Also on {when}
        </span>
        <span className="text-[11px] text-ink-2">Same entry · one night</span>
      </div>
      <ul className="m-0 list-none p-0">
        {events.map((e, i) => (
          <li
            key={e.id}
            className={i > 0 ? "border-t border-ink/10" : undefined}
            style={{ "--ev-c": e.color } as React.CSSProperties}
          >
            <Link href={`/whats-on/${e.id}`} className="flex items-center gap-3 px-3.5 py-2.5">
              <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[10px] bg-canvas">
                {e.imageUrl ? (
                  <Image src={e.imageUrl} alt="" fill sizes="56px" className="object-cover object-[center_70%]" />
                ) : (
                  <span className="absolute inset-0 bg-linear-to-br from-(--ev-c)/60 to-canvas" aria-hidden="true" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-black text-xs tracking-wide text-gold tabular-nums">{e.startTimeLabel ?? "Late"}</span>
                <span className="mt-0.5 block truncate font-black text-base leading-none tracking-tight text-ink uppercase">{e.title}</span>
                <span className="mt-1 block truncate text-[11px] text-ink-2">
                  {[i === 0 ? "Support" : null, e.subType, e.tagline].filter(Boolean).join(" · ")}
                </span>
              </span>
              <ChevronRight className="h-4.5 w-4.5 shrink-0 text-ink" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
