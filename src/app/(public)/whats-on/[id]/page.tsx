import Image from "next/image";
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
  Ticket,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PublicNav } from "@/components/public-nav";
import { EventCta } from "@/components/editorial/event-cta";
import { EventGridCard } from "@/components/editorial/event-grid-card";
import { BandMedia } from "@/components/editorial/band-media";
import {
  entryText,
  getEventType,
  parseDate,
  serializeEvent,
  type BandInfo,
  type EventRow,
} from "@/lib/events-display";

export const revalidate = 300;

const EVENT_SELECT =
  "id, title, date, start_time, end_time, tagline, image_url, is_active, is_fully_booked, is_bookable, payment_amount, external_link, booking_page_url, karaoke_request_url, event_types!inner(name, color), event_subtypes!inner(name, color, behavior, tagline)";

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
    .select(EVENT_SELECT)
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

  const [{ data: info }, { data: rawMore }] = await Promise.all([
    supabase.from("company_information").select("*").maybeSingle(),
    supabase
      .from("events")
      .select(EVENT_SELECT)
      .gte("date", todayStr)
      .neq("id", row.id)
      .eq("is_active", true)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(8),
  ]);

  const event = serializeEvent(row, band);
  const dateObj = parseDate(event.date);
  const isPast = event.date < todayStr;
  const timeLabel = event.startTimeLabel
    ? `${event.startTimeLabel}${event.endTimeLabel ? ` – ${event.endTimeLabel}` : ""}`
    : null;

  const more = ((rawMore ?? []) as EventRow[])
    .filter((e) => getEventType(e)?.behavior !== "private")
    .slice(0, 3)
    .map((e) => serializeEvent(e));

  const venueName = (info?.name as string) || "Don Fenticas";
  const address = info?.address as string | undefined;
  const phone = info?.phone as string | undefined;

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

      <div className="relative z-10 mx-auto max-w-4xl px-4 py-6 sm:py-10">
        <Link
          href="/whats-on"
          className="inline-flex min-h-11 items-center gap-2 font-black text-[10px] tracking-[0.25em] text-ink-2 uppercase transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          All events
        </Link>

        <article
          className="mt-4"
          style={{ "--ev-c": event.color } as React.CSSProperties}
        >
          <div className="ad-poster relative flex aspect-16/9 items-center justify-center overflow-hidden rounded-3xl border border-hairline">
            {event.imageUrl ? (
              <Image
                src={event.imageUrl}
                alt={event.title}
                fill
                priority
                sizes="(max-width: 896px) 100vw, 896px"
                className={"object-cover " + (isPast ? "grayscale" : "")}
              />
            ) : (
              <Ticket className="h-12 w-12 text-ink-2/40" aria-hidden="true" />
            )}

            {event.isFullyBooked && (
              <span className="absolute top-4 right-4 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 font-black text-[10px] tracking-widest text-red-400 uppercase backdrop-blur-sm">
                Sold Out
              </span>
            )}
          </div>

          <header className="mt-6">
            {event.subType && (
              <span
                className="ev-text mb-3 inline-block rounded-full border border-hairline bg-canvas-2 px-3 py-1.5 font-black text-[10px] tracking-[0.25em] uppercase"
                style={{ "--ev-c": event.color } as React.CSSProperties}
              >
                {event.subType}
              </span>
            )}

            <h1 className="font-black text-[clamp(2rem,7vw,3.5rem)] leading-[0.92] tracking-tighter text-ink uppercase">
              {event.title}
            </h1>

            {event.tagline && (
              <p className="mt-4 text-base leading-relaxed font-medium text-stone-400">
                {event.tagline}
              </p>
            )}
          </header>

          <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-hairline bg-canvas-2 p-4">
              <dt className="flex items-center gap-2 font-black text-[10px] tracking-widest text-ink-2 uppercase">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Date
              </dt>
              <dd className="mt-1.5 font-black text-sm tracking-tight text-ink uppercase">
                {format(dateObj, "EEEE d MMMM, yyyy")}
              </dd>
            </div>

            <div className="rounded-2xl border border-hairline bg-canvas-2 p-4">
              <dt className="flex items-center gap-2 font-black text-[10px] tracking-widest text-ink-2 uppercase">
                <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Time
              </dt>
              <dd className="mt-1.5 font-black text-sm tracking-tight text-ink tabular-nums uppercase">
                {timeLabel ?? "TBC"}
              </dd>
            </div>

            <div className="rounded-2xl border border-hairline bg-canvas-2 p-4">
              <dt className="flex items-center gap-2 font-black text-[10px] tracking-widest text-ink-2 uppercase">
                <Ticket className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Entry
              </dt>
              <dd className="mt-1.5 font-black text-sm tracking-tight text-ink uppercase">
                {entryText(event)}
              </dd>
            </div>
          </dl>

          {!isPast && (
            <div className="mt-6 flex flex-col gap-3">
              <EventCta event={event} size="lg" bookLabel="Book Tickets Now" />
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
            </div>
          )}

          {isPast && (
            <p className="mt-6 rounded-2xl border border-hairline bg-white/4 px-4 py-3 text-center text-xs font-bold tracking-widest text-ink-2 uppercase">
              This show has already happened
            </p>
          )}

          {event.behavior === "music_act" && event.band && (
            <section className="mt-10">
              <h2 className="mb-4 font-black text-[10px] tracking-[0.25em] text-gold uppercase">
                Listen &amp; follow
              </h2>
              <BandMedia band={event.band} title={event.title} />
            </section>
          )}

          {(address || phone) && (
            <section className="mt-10">
              <h2 className="mb-4 font-black text-[10px] tracking-[0.25em] text-gold uppercase">
                Where
              </h2>
              <div className="rounded-2xl border border-hairline bg-canvas-2 p-5">
                <p className="font-black text-lg tracking-tight text-ink uppercase">
                  {venueName}
                </p>
                {address && (
                  <p className="mt-1.5 text-sm leading-relaxed text-stone-400">{address}</p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
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
              </div>
            </section>
          )}
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
