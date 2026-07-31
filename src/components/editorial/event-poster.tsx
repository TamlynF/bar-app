import Image from "next/image";
import {
  ArrowUpRight,
  Disc3,
  Mic2,
  Music,
  PartyPopper,
  Star,
  Ticket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatGBP, type SerializedEvent } from "@/lib/events-display";

export function eventIcon(event: SerializedEvent, className: string) {
  const key = (event.subType ?? "").toLowerCase();
  if (key.includes("karaoke")) return <Mic2 className={className} />;
  if (key.includes("quiz")) return <Star className={className} />;
  if (key.includes("bingo") || key.includes("gig"))
    return <Ticket className={className} />;
  if (key.includes("dj")) return <Disc3 className={className} />;
  if (key.includes("band")) return <Music className={className} />;
  if (key.includes("birthday") || key.includes("private"))
    return <PartyPopper className={className} />;
  return event.isKaraoke ? (
    <Mic2 className={className} />
  ) : (
    <Music className={className} />
  );
}

export function PosterTint() {
  return (
    <div
      className="pointer-events-none absolute inset-0 bg-canvas/20 mix-blend-multiply"
      aria-hidden="true"
    />
  );
}

export function EventPoster({
  event,
  sizes,
  alt = "",
  priority = false,
  grayscale = false,
  zoomOnHover = false,
  aspect = "aspect-4/5",
  className = "",
  children,
}: {
  event: SerializedEvent;
  sizes: string;
  alt?: string;
  priority?: boolean;
  grayscale?: boolean;
  zoomOnHover?: boolean;
  aspect?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`ad-poster relative flex ${aspect} items-center justify-center overflow-hidden ${className}`}
      style={{ "--ev-c": event.color } as React.CSSProperties}
    >
      {event.imageUrl ? (
        <Image
          src={event.imageUrl}
          alt={alt}
          fill
          priority={priority}
          sizes={sizes}
          className={
            "object-cover " +
            (zoomOnHover
              ? "transition-transform duration-500 group-hover:scale-105 "
              : "") +
            (grayscale ? "grayscale" : "")
          }
        />
      ) : (
        <span
          className="ad-kind flex h-16 w-16 items-center justify-center rounded-2xl border"
          aria-hidden="true"
        >
          {eventIcon(event, "w-7 h-7")}
        </span>
      )}

      <PosterTint />

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-black/60 to-transparent"
        aria-hidden="true"
      />

      {children}
    </div>
  );
}

export function PosterChip({ event }: { event: SerializedEvent }) {
  if (!event.subType) return null;
  return (
    <span
      className="absolute top-0 left-0 rounded-tl-3xl rounded-br-xl bg-(--ev-c) px-3.5 py-2 font-black text-xs tracking-[0.18em] text-canvas uppercase shadow-lg shadow-black/40"
      style={{ "--ev-c": event.color } as React.CSSProperties}
    >
      {event.subType}
    </span>
  );
}

export function PriceChip({
  event,
  treatUnpricedAsFree = false,
  className = "absolute top-3 right-3",
}: {
  event: SerializedEvent;
  treatUnpricedAsFree?: boolean;
  className?: string;
}) {
  if (event.price == null && !treatUnpricedAsFree) return null;
  const price = event.price ?? 0;
  const paid = price > 0;
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 font-black text-[10px] tracking-widest uppercase",
        paid
          ? "bg-gold text-on-gold shadow-lg shadow-black/40"
          : "border border-gold/40 bg-canvas/80 text-gold backdrop-blur-sm",
        className
      )}
    >
      {paid ? formatGBP(price) : "Free"}
    </span>
  );
}

export function PosterHoverHint() {
  return (
    <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-canvas/85 px-4 py-2 font-black text-[11px] tracking-widest text-ink uppercase shadow-lg shadow-black/40 backdrop-blur-sm">
        View details
        <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
      </span>
    </span>
  );
}
