import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  ExternalLink,
  MapPin,
  Phone,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCompanyInfo } from "@/lib/company-info";
import { PublicNav } from "@/components/public-nav";
import { BookingButton } from "@/components/editorial/booking-button";
import { EventGridCard } from "@/components/editorial/event-grid-card";
import { EventPoster } from "@/components/editorial/event-poster";
import { BandMedia } from "@/components/editorial/band-media";
import { ShareLinks } from "@/components/editorial/share-links";
import {
  entryText,
  formatTime,
  getEventType,
  parseDate,
  serializeEvent,
  BOOKED_BAND_FILTER,
  PUBLIC_EVENT_SELECT,
  type BandInfo,
  type EventRow,
} from "@/lib/events-display";
import type { OpeningHours } from "@/lib/opening-hours";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("title, tagline, date")
    .eq("id", id)
    .maybeSingle();

  if (!event) return { title: "Event | Don Fenticas" };

  const dateLabel = format(parseDate(event.date as string), "d MMMM yyyy");
  return {
    title: `${event.title} · ${dateLabel} | Don Fenticas`,
    description: (event.tagline as string) || `${event.title} at Don Fenticas on ${dateLabel}.`,
  };
}

export default async function WhatsOnEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const todayStr = new Date().toISOString().split("T")[0];

  const { data: raw } = await supabase
    .from("events")
    .select(PUBLIC_EVENT_SELECT)
    .eq(BOOKED_BAND_FILTER, "booked")
    .eq("id", id)
    .maybeSingle();

  const row = raw as EventRow | null;
  if (!row) notFound();

  const eventType = getEventType(row);
  if (eventType?.behavior === "private") notFound();
  if (row.date >= todayStr && !row.is_active) notFound();

  let band: BandInfo | null = null;
  if (eventType?.behavior === "music_act") {
    const { data: bandRow } = await supabase
      .from("band_booking_requests")
      .select("social_links, video_urls, video_descriptions")
      .eq("event_id", row.id)
      .eq("status", "booked")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (bandRow) {
      const socials = (bandRow.social_links ?? {}) as Record<string, string>;
      const urls = ((bandRow.video_urls ?? []) as string[]).filter(Boolean);
      const descs = (bandRow.video_descriptions ?? []) as string[];
      band = {
        socialLinks: {
          instagram: socials.instagram?.trim() || undefined,
          facebook: socials.facebook?.trim() || undefined,
          youtube: socials.youtube?.trim() || undefined,
          tiktok: socials.tiktok?.trim() || undefined,
        },
        videos: urls.map((url, i) => ({ url, description: (descs[i] ?? "").trim() })),
      };
    }
  }

  const followOnQuery = row.start_time
    ? supabase
        .from("events")
        .select(PUBLIC_EVENT_SELECT)
        .eq(BOOKED_BAND_FILTER, "booked")
        .eq("date", row.date)
        .eq("is_active", true)
        .neq("id", row.id)
        .gt("start_time", row.start_time)
        .order("start_time", { ascending: true })
        .limit(3)
        .then(({ data }) => data)
    : Promise.resolve(null);

  const [info, { data: rawMore }, rawFollowOn] = await Promise.all([
    getCompanyInfo(),
    supabase
      .from("events")
      .select(PUBLIC_EVENT_SELECT)
      .eq(BOOKED_BAND_FILTER, "booked")
      .gte("date", todayStr)
      .neq("id", row.id)
      .eq("is_active", true)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(8),
    followOnQuery,
  ]);

  const event = serializeEvent(row, band);
  const dateObj = parseDate(event.date);
  const isPast = event.date < todayStr;

  const more = ((rawMore ?? []) as EventRow[])
    .filter((e) => getEventType(e)?.behavior !== "private")
    .slice(0, 3)
    .map((e) => serializeEvent(e));

  const followOnRow = ((rawFollowOn ?? []) as EventRow[]).find(
    (e) => getEventType(e)?.behavior !== "private"
  );
  const followOn = followOnRow ? serializeEvent(followOnRow) : null;
  const followOnIsDjSet =
    followOn?.subType?.trim().toLowerCase().startsWith("dj") ?? false;

  const venueName = (info?.name as string) || "Don Fenticas";
  const address = info?.address as string | undefined;
  const phone = info?.phone as string | undefined;

  const openingHours = (info?.opening_hours ?? {}) as OpeningHours;
  const eventDayKey = format(dateObj, "EEEE").toLowerCase();
  const doorsLabel = formatTime(openingHours[eventDayKey]?.open ?? null);
  const startRowLabel = event.isKaraoke ? "Karaoke" : "Show time";

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const shareUrl = `${siteUrl}/whats-on/${event.id}`;
  const shareTitle = `${event.title} · ${format(dateObj, "d MMM yyyy")} · ${venueName}`;

  return (
    <main className="relative isolate min-h-dvh w-full overflow-hidden bg-canvas pb-24 text-ink-2 antialiased selection:bg-[#FDCC4B] selection:text-[#1a2008]">
      <div
        className="pointer-events-none absolute -top-40 -left-30 h-130 w-130 rounded-full bg-[#FDCC4B]/10 blur-[120px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-20 -right-40 h-110 w-110 rounded-full bg-[#7A1F1F]/25 blur-[120px]"
        aria-hidden="true"
      />

      <PublicNav currentPath="/whats-on" />

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-6 sm:py-10">
        <Link
          href="/whats-on"
          className="inline-flex min-h-11 items-center gap-2 font-black text-[10px] tracking-[0.25em] text-ink-2 uppercase transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          All events
        </Link>

        <article
          className="mt-4 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-start lg:gap-14"
          style={{ "--ev-c": event.color } as React.CSSProperties}
        >
          <div>
            <header>
              {event.subType && (
                <span
                  className="ev-text mb-3 inline-block rounded-full border border-hairline bg-canvas-2 px-3 py-1.5 font-black text-[10px] tracking-[0.25em] uppercase"
                  style={{ "--ev-c": event.color } as React.CSSProperties}
                >
                  {event.subType}
                </span>
              )}

              <h1 className="font-black text-[clamp(1.75rem,5.5vw,2.75rem)] leading-[0.95] tracking-tighter text-ink uppercase">
                {event.title}
              </h1>

              {followOn && (
                <Link
                  href={`/whats-on/${followOn.id}`}
                  className="mt-3 inline-flex min-h-11 items-start gap-2.5 text-sm font-bold text-ink-2 transition-colors hover:text-ink"
                >
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
                  <span>
                    Followed by{" "}
                    <span className="font-black text-gold underline underline-offset-4">
                      {followOn.title}
                    </span>
                    {followOnIsDjSet ? " DJ set" : ""}.
                  </span>
                </Link>
              )}

              <p className="mt-4 flex items-center gap-2.5 font-black text-sm tracking-tight text-ink">
                <CalendarDays className="h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
                {format(dateObj, "d MMMM, yyyy")}
              </p>

              <p className="mt-2 flex items-start gap-2.5 text-sm font-bold text-ink-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
                <span>
                  {venueName}
                  {address ? ` — ${address}` : ""}
                </span>
              </p>
            </header>

            <section className="mt-7 rounded-2xl border border-hairline bg-canvas-2 p-5 sm:p-6">
              <h2 className="font-black text-xl tracking-tight text-ink">
                {isPast
                  ? "This show has finished"
                  : event.isBookable
                    ? "Get your tickets!"
                    : "Free entry — just walk in"}
              </h2>

              <div className="mt-5 flex items-center justify-between gap-4 border-b border-hairline pb-5">
                <div className="min-w-0">
                  <p className="font-bold text-sm text-ink">
                    {event.subType && (
                      <span className="capitalize">{event.subType} / </span>
                    )}
                    {event.title}
                  </p>
                  <p className="mt-1 text-xs font-medium text-ink-2">{entryText(event)}</p>
                </div>
                {event.isFullyBooked ? (
                  <span className="shrink-0 rounded-full border border-red-500/25 bg-red-500/10 px-4 py-2 font-black text-[10px] tracking-widest text-red-400 uppercase">
                    Sold Out
                  </span>
                ) : (
                  <span className="shrink-0 font-black text-xl tracking-tight text-ink tabular-nums">
                    {event.price != null && event.price > 0 ? `£${event.price}` : "Free"}
                  </span>
                )}
              </div>

              <dl className="mt-5 space-y-2.5">
                <div className="flex items-center justify-between gap-4">
                  <dt className="font-bold text-[11px] tracking-widest text-ink-2 uppercase">
                    Doors
                  </dt>
                  <dd className="font-black text-sm text-ink tabular-nums">
                    {doorsLabel ?? event.startTimeLabel ?? "TBC"}
                  </dd>
                </div>
                {event.startTimeLabel && (
                  <div className="flex items-center justify-between gap-4">
                    <dt className="font-bold text-[11px] tracking-widest text-ink-2 uppercase">
                      {startRowLabel}
                    </dt>
                    <dd className="font-black text-sm text-ink tabular-nums">
                      {event.startTimeLabel}
                    </dd>
                  </div>
                )}
                {event.endTimeLabel && (
                  <div className="flex items-center justify-between gap-4">
                    <dt className="font-bold text-[11px] tracking-widest text-ink-2 uppercase">
                      Finishes
                    </dt>
                    <dd className="font-black text-sm text-ink tabular-nums">
                      {event.endTimeLabel}
                    </dd>
                  </div>
                )}
              </dl>

              {!isPast ? (
                <div className="mt-6 flex flex-col gap-3">
                  <BookingButton event={event} />
                  {event.externalLink && (
                    <a
                      href={event.externalLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-hairline bg-white/5 font-black text-sm tracking-wide text-ink uppercase transition-colors hover:bg-white/10"
                    >
                      <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
                      Get Tickets
                    </a>
                  )}
                  <p className="text-center text-[11px] font-medium text-ink-2/70">
                    Over 18s only. Please drink responsibly.
                  </p>
                </div>
              ) : (
                <p className="mt-6 rounded-xl border border-hairline bg-white/4 px-4 py-3 text-center text-xs font-bold tracking-widest text-ink-2 uppercase">
                  This show has already happened
                </p>
              )}
            </section>
          </div>

          <div>
            <EventPoster
              event={event}
              alt={event.title}
              priority
              grayscale={isPast}
              aspect="aspect-square"
              className="rounded-2xl border border-hairline"
              sizes="(max-width: 1024px) 100vw, 480px"
            >
              {event.isFullyBooked && (
                <span className="absolute top-4 right-4 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 font-black text-[10px] tracking-widest text-red-400 uppercase backdrop-blur-sm">
                  Sold Out
                </span>
              )}
            </EventPoster>

            <div className="mt-7 flex flex-wrap items-center gap-4">
              <h2 className="font-black text-sm tracking-tight text-ink">Share Event:</h2>
              <ShareLinks url={shareUrl} title={shareTitle} />
            </div>

            <section className="mt-8">
              <h2 className="font-black text-xl tracking-tight text-ink">
                Event Information
              </h2>
              <dl className="mt-4 space-y-2">
                <div className="flex items-baseline gap-2">
                  <dt className="font-bold text-sm text-ink">Start Time:</dt>
                  <dd className="font-black text-sm text-gold tabular-nums">
                    {event.startTimeLabel ?? "TBC"}
                  </dd>
                </div>
                {event.endTimeLabel && (
                  <div className="flex items-baseline gap-2">
                    <dt className="font-bold text-sm text-ink">Last Orders:</dt>
                    <dd className="font-black text-sm text-gold tabular-nums">
                      {event.endTimeLabel}
                    </dd>
                  </div>
                )}
                <div className="flex items-baseline gap-2">
                  <dt className="font-bold text-sm text-ink">Entry:</dt>
                  <dd className="font-black text-sm text-gold">{entryText(event)}</dd>
                </div>
              </dl>

              {event.tagline && (
                <p className="mt-5 text-sm leading-relaxed font-medium text-ink-2">
                  {event.tagline}
                </p>
              )}

              <div className="mt-5 flex flex-wrap gap-2">
                {address && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      `${venueName} ${address}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 items-center gap-2 rounded-full border border-hairline bg-white/5 px-4 font-black text-[10px] tracking-widest text-ink uppercase transition-colors hover:bg-white/10"
                  >
                    <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Get directions
                  </a>
                )}
                {phone && (
                  <a
                    href={`tel:${phone.replace(/\s/g, "")}`}
                    className="inline-flex h-11 items-center gap-2 rounded-full border border-hairline bg-white/5 px-4 font-black text-[10px] tracking-widest text-ink uppercase transition-colors hover:bg-white/10"
                  >
                    <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {phone}
                  </a>
                )}
              </div>
            </section>

            {event.behavior === "music_act" && event.band && (
              <section className="mt-8">
                <h2 className="mb-4 font-black text-xl tracking-tight text-ink">
                  Listen &amp; follow
                </h2>
                <BandMedia band={event.band} title={event.title} />
              </section>
            )}
          </div>
        </article>

        {more.length > 0 && (
          <section className="mt-14">
            <div className="mb-5 flex items-end justify-between gap-4 border-b border-hairline pb-4">
              <h2 className="font-black text-2xl tracking-tighter text-ink uppercase">
                More events
              </h2>
              <Link
                href="/whats-on"
                className="shrink-0 pb-1 font-black text-[10px] tracking-widest text-ink-2 uppercase transition-colors hover:text-ink"
              >
                See all
              </Link>
            </div>
            <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {more.map((e) => (
                <EventGridCard key={e.id} event={e} />
              ))}
            </ul>
          </section>
        )}

        <footer className="mt-16 text-center">
          <div className="flex items-center justify-center gap-4 text-stone-800">
            <div className="h-px w-6 bg-stone-800/50" />
            <span className="text-[9px] font-bold tracking-[0.4em] uppercase">Don Fenticas</span>
            <div className="h-px w-6 bg-stone-800/50" />
          </div>
          <p className="mt-2 text-[9px] tracking-widest text-stone-700 uppercase">
            &copy; {new Date().getFullYear()} &middot; Licensed Venue &middot; Drink Responsibly
          </p>
        </footer>
      </div>
    </main>
  );
}
