import React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowRight, Calendar, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PublicNav } from "@/components/public-nav";
import { SectionHeading } from "@/components/editorial/section-heading";
import { PageHeader } from "@/components/editorial/page-header";
import { cardIcon } from "@/lib/booking-card-icons";
import { swatchHexFromColor } from "@/lib/event-type-colors";

export const metadata = {
  title: "Book",
  description: "Book a table, a band slot, or a private event at Don Fenticas.",
  openGraph: {
    title: "Book a night at Don Fenticas",
    description: "Quiz tables, music bingo, live gigs and private hire.",
  },
  twitter: { card: "summary_large_image" },
};

type CardSource = {
  booking_card_title: string | null;
  booking_card_tagline: string | null;
  booking_card_icon: string | null;
  booking_card_badge: string | null;
};

type RawType = { id: number; name: string | null; color: string | null; booking_grouping: string | null } & CardSource;
type RawSubtype = { id: number; name: string | null; color: string | null; tagline: string | null; behavior: string | null } & CardSource;

type RawBookableEvent = {
  id: number;
  date: string;
  title: string | null;
  tagline: string | null;
  payment_amount: number | null;
  is_fully_booked: boolean | null;
  event_types_id: number;
  event_subtypes_id: number | null;
  booking_card_title: string | null;
  booking_card_tagline: string | null;
  booking_card_icon: string | null;
  booking_card_badge: string | null;
  event_types: RawType | RawType[] | null;
  event_subtypes: RawSubtype | RawSubtype[] | null;
};

type BookingCard = {
  key: string;
  href: string;
  title: string;
  tagline: string;
  icon: string | null; // Lucide icon name, resolved at render
  note: string | null; // admin line under the title (e.g. "Thursdays")
  label: string | null; // kind of night: the subtype or type name
  cta: string; // footer verb - derived, never authored
  colorHex: string; // tint for icon + badge
  date: string | null; // earliest upcoming date (YYYY-MM-DD); null on standing enquiries
  count: number; // number of events represented (1 = single event)
  isFree: boolean;
  isFullyBooked: boolean;
  paymentAmount: number | null;
  isRequest: boolean; // standing enquiry → shown under Requests & Enquiries
};

const first = <T,>(v: T | T[] | null): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : v;

const GOLD = "#FDCC4B";

const isPrivateBehavior = (behavior: string | null | undefined) =>
  behavior === "private";

const REQUEST_CARDS: BookingCard[] = [
  {
    key: "request-music_act",
    href: "/book/band",
    title: "Play Our Stage",
    tagline: "Bands, DJs and solo artists - send us your links and we'll find you a date.",
    icon: "Music",
    note: null,
    label: null,
    cta: "Apply to play",
    colorHex: GOLD,
    date: null,
    count: 1,
    isFree: true,
    isFullyBooked: false,
    paymentAmount: null,
    isRequest: true,
  },
  {
    key: "request-private",
    href: "/book/private",
    title: "Private Hire",
    tagline: "Birthdays, wedding receptions, corporate nights - tell us what you need.",
    icon: "Sparkles",
    note: null,
    label: null,
    cta: "Send an enquiry",
    colorHex: GOLD,
    date: null,
    count: 1,
    isFree: true,
    isFullyBooked: false,
    paymentAmount: null,
    isRequest: true,
  },
];

function buildBookingCards(events: RawBookableEvent[]): BookingCard[] {
  const cards: BookingCard[] = [];
  const groups = new Map<string, BookingCard>();

  for (const ev of events) {
    const type = first(ev.event_types);
    const subtype = first(ev.event_subtypes);
    if (isPrivateBehavior(subtype?.behavior)) continue;
    const grouping = type?.booking_grouping ?? "per_event";
    const isFree = !ev.payment_amount || ev.payment_amount === 0;

    const mode = grouping === "per_subtype" && !subtype ? "per_event" : grouping;

    const source: CardSource | null = mode === "per_type" ? type : mode === "per_subtype" ? subtype : ev;
    const colorKey = mode === "per_type" ? type?.color : subtype?.color;
    const colorHex = swatchHexFromColor(colorKey) ?? GOLD;
    const taglineFallback = subtype?.tagline || ev.tagline || "";
    const label = subtype?.name || type?.name || null;

    if (mode === "per_event") {
      cards.push({
        key: `e-${ev.id}`,
        href: `/book/event/${ev.id}`,
        title: source?.booking_card_title || ev.title || "Event",
        tagline: source?.booking_card_tagline || taglineFallback,
        icon: source?.booking_card_icon ?? null,
        note: source?.booking_card_badge || null,
        label,
        cta: "Book",
        colorHex,
        date: ev.date,
        count: 1,
        isFree,
        isFullyBooked: !!ev.is_fully_booked,
        paymentAmount: ev.payment_amount ?? null,
        isRequest: false,
      });
      continue;
    }

    const groupKey =
      mode === "per_subtype"
        ? `subtype-${subtype!.id}`
        : `type-${ev.event_types_id}`;
    const existing = groups.get(groupKey);
    if (existing) {
      existing.count += 1;
      existing.isFullyBooked = existing.isFullyBooked && !!ev.is_fully_booked;
      continue;
    }
    const fallbackTitle = (mode === "per_subtype" ? subtype!.name : type?.name) || ev.title || "Events";
    const card: BookingCard = {
      key: groupKey,
      href:
        mode === "per_subtype"
          ? `/book/group/subtype/${subtype!.id}`
          : `/book/group/type/${ev.event_types_id}`,
      title: source?.booking_card_title || fallbackTitle,
      tagline: source?.booking_card_tagline || taglineFallback,
      icon: source?.booking_card_icon ?? null,
      note: source?.booking_card_badge || null,
      label,
      cta: "Book",
      colorHex,
      date: ev.date,
      count: 1,
      isFree,
      isFullyBooked: !!ev.is_fully_booked,
      paymentAmount: ev.payment_amount ?? null,
      isRequest: false,
    };
    groups.set(groupKey, card);
    cards.push(card);
  }

  return cards.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
}

type MonthGroup = { key: string; label: string; cards: BookingCard[] };

function groupByMonth(cards: BookingCard[]): MonthGroup[] {
  const months: MonthGroup[] = [];
  for (const card of cards) {
    const key = (card.date ?? "").slice(0, 7);
    let month = months.find((m) => m.key === key);
    if (!month) {
      month = {
        key,
        label: card.date ? format(new Date(card.date + "T00:00:00"), "MMMM yyyy") : "Coming up",
        cards: [],
      };
      months.push(month);
    }
    month.cards.push(card);
  }
  return months;
}

function sentenceCase(text: string | null) {
  if (!text) return null;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function priceLabel(card: BookingCard) {
  if (card.isFullyBooked) return "Full";
  if (card.isFree) return "Free";
  return `£${card.paymentAmount!.toFixed(2)}`;
}

const LIST =
  "flex flex-col divide-y divide-hairline overflow-hidden rounded-2xl border border-gold bg-white/8";

const ROW_TITLE =
  "line-clamp-2 font-black text-btn leading-tight tracking-tight text-ink uppercase transition-colors group-hover:text-gold sm:text-h3";

function RowChevron() {
  return (
    <ChevronRight
      className="h-4.5 w-4.5 shrink-0 text-ink-2 transition-transform group-hover:translate-x-0.5 group-hover:text-gold"
      aria-hidden="true"
    />
  );
}

function TicketRow({ card }: { card: BookingCard }) {
  const isGroup = card.count > 1;
  const date = card.date ? new Date(card.date + "T00:00:00") : null;
  const meta = [
    sentenceCase(card.label),
    card.note,
    isGroup && date ? `Next ${format(date, "EEE d MMM")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const ctaLabel = isGroup ? `Choose from ${card.count} dates` : "Book this date";

  return (
    <li>
      <Link
        href={card.href}
        style={{ "--cc": card.colorHex } as React.CSSProperties}
        aria-label={`${card.title} - ${ctaLabel}`}
        className="group flex items-stretch transition-colors hover:bg-white/6 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold"
      >
        <div className="flex w-16 shrink-0 flex-col items-center justify-center gap-1 border-r border-dashed border-white/20 py-3.5">
          {isGroup ? (
            <>
              <span className="font-bold font-stretch-condensed text-3xl leading-none text-gold tabular-nums">
                {card.count}
              </span>
              <span className="text-pill font-bold tracking-wide text-ink-2 uppercase">Dates</span>
            </>
          ) : date ? (
            <>
              <span className="text-pill font-bold tracking-wide text-ink-2 uppercase">
                {format(date, "EEE")}
              </span>
              <span className="font-bold font-stretch-condensed text-3xl leading-none text-gold tabular-nums">
                {format(date, "dd")}
              </span>
            </>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-3 px-3.5 py-3.5">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className={ROW_TITLE}>{card.title}</span>
            {meta && <span className="text-meta text-(--cc)">{meta}</span>}
            {card.tagline && (
              <span className="hidden text-meta text-ink-2 sm:line-clamp-1">{card.tagline}</span>
            )}
          </div>
          <span
            className={
              card.isFullyBooked
                ? "shrink-0 rounded-full border border-red-500/30 bg-red-500/20 px-2 py-0.5 text-pill font-bold tracking-wide text-red-400 uppercase"
                : "shrink-0 rounded-full border border-(--cc)/25 bg-(--cc)/12 px-2 py-0.5 text-pill font-bold tracking-wide text-(--cc) uppercase"
            }
          >
            {priceLabel(card)}
          </span>
          <RowChevron />
        </div>
      </Link>
    </li>
  );
}

function RequestRow({ card }: { card: BookingCard }) {
  return (
    <li>
      <Link
        href={card.href}
        aria-label={`${card.title} - ${card.cta}`}
        className="group flex h-full items-center gap-3.5 px-3.5 py-3.5 transition-colors hover:bg-white/6 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-gold/10">
          {React.createElement(cardIcon(card.icon), { className: "h-5 w-5 text-gold", "aria-hidden": true })}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className={ROW_TITLE}>{card.title}</span>
          <span className="line-clamp-2 text-meta text-ink-2">{card.tagline}</span>
          <span className="text-meta font-semibold text-gold">{card.cta}</span>
        </span>
        <RowChevron />
      </Link>
    </li>
  );
}

export default async function BookingHubPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: bookableEvents } = await supabase
    .from("events")
    .select(
      "id, date, title, tagline, payment_amount, is_fully_booked, event_types_id, event_subtypes_id, booking_card_title, booking_card_tagline, booking_card_icon, booking_card_badge, event_types!inner(id, name, color, booking_grouping, booking_card_title, booking_card_tagline, booking_card_icon, booking_card_badge), event_subtypes(id, name, color, tagline, behavior, booking_card_title, booking_card_tagline, booking_card_icon, booking_card_badge)"
    )
    .eq("is_active", true)
    .eq("is_bookable", true)
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(50);

  const months = groupByMonth(buildBookingCards((bookableEvents ?? []) as RawBookableEvent[]));
  const requestCards = REQUEST_CARDS;

  return (
    <main className="min-h-dvh w-full bg-canvas px-4 pb-12 text-ink-2 antialiased selection:bg-[#FDCC4B] selection:text-[#1a2008]">
      <PublicNav currentPath="/book" />

      <div className="mx-auto max-w-5xl py-8 sm:py-12">
        <PageHeader
          eyebrow="Bookings"
          title="Book Your Experience"
          subtitle="Tickets for what's on - or get in touch about playing our stage and private hire."
        />

        <div>
          <SectionHeading eyebrow="Tickets" title="Upcoming Events" />
          {months.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
              {months.map((month) => (
                <section key={month.key} aria-labelledby={`month-${month.key}`}>
                  <h3
                    id={`month-${month.key}`}
                    className="mb-2.5 flex items-baseline justify-between gap-3 px-1"
                  >
                    <span className="font-black text-btn tracking-tight text-gold uppercase">
                      {month.label}
                    </span>
                    <span className="text-meta text-ink-2">
                      {month.cards.length} {month.cards.length === 1 ? "event" : "events"}
                    </span>
                  </h3>
                  <ul className={LIST}>
                    {month.cards.map((card) => (
                      <TicketRow key={card.key} card={card} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-hairline bg-white/3 py-16 text-center">
              <Calendar className="mx-auto mb-3 h-8 w-8 text-ink-2/50" aria-hidden="true" />
              <p className="font-black text-sm tracking-tight text-ink-2 uppercase">
                Nothing Ticketed Right Now
              </p>
              <Link
                href="/whats-on"
                className="mt-2 inline-flex items-center gap-1.5 font-black text-[10px] tracking-widest text-[#FDCC4B] uppercase transition-all hover:gap-2.5"
              >
                See what&apos;s on
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          )}
        </div>

        {requestCards.length > 0 && (
          <div className="mt-12 sm:mt-16">
            <SectionHeading eyebrow="Get in touch" title="Requests & Enquiries" />
            <ul className={LIST + " lg:grid lg:grid-cols-2 lg:divide-x lg:divide-y-0"}>
              {requestCards.map((card) => (
                <RequestRow key={card.key} card={card} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
