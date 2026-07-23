import Image from "next/image";
import {
  Disc3,
  Mic2,
  Music,
  PartyPopper,
  Star,
  Ticket,
} from "lucide-react";
import type { SerializedEvent } from "@/lib/events-display";

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
        className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-black/92 via-black/55 to-transparent"
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
