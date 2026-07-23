import React from "react";
import Link from "next/link";
import { ArrowRight, Calendar } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PublicNav } from "@/components/public-nav";
import { SectionHeading } from "@/components/editorial/section-heading";
import { PageHeader } from "@/components/editorial/page-header";
import { DateChip } from "@/components/editorial/date-chip";
import { cardIcon } from "@/lib/booking-card-icons";
import { swatchHexFromColor } from "@/lib/event-type-colors";

export const metadata = {
  title: "Book | Don Fenticas",
  description: "Book a table, a band slot, or a private event at Don Fenticas.",
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
  cta: string; // footer verb — derived, never authored
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

const isRequestBehavior = (behavior: string | null | undefined) =>
  behavior === "private" || behavior === "music_act";

const REQUEST_CARDS: BookingCard[] = [
  {
    key: "request-music_act",
    href: "/book/band",
    title: "Play Our Stage",
    tagline: "Bands, DJs and solo artists — send us your links and we'll find you a date.",
    icon: "Music",
    note: null,
    cta: "Apply",
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
    tagline: "Birthdays, wedding receptions, corporate nights — tell us what you need.",
    icon: "Sparkles",
    note: null,
    cta: "Enquire",
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
    if (isRequestBehavior(subtype?.behavior)) continue;
    const grouping = type?.booking_grouping ?? "per_event";
    const isFree = !ev.payment_amount || ev.payment_amount === 0;

    const mode = grouping === "per_subtype" && !subtype ? "per_event" : grouping;

    const source: CardSource | null = mode === "per_type" ? type : mode === "per_subtype" ? subtype : ev;
    const colorKey = mode === "per_type" ? type?.color : subtype?.color;
    const colorHex = swatchHexFromColor(colorKey) ?? GOLD;
    const taglineFallback = subtype?.tagline || ev.tagline || "";

    if (mode === "per_event") {
      cards.push({
        key: `e-${ev.id}`,
        href: `/book/event/${ev.id}`,
        title: source?.booking_card_title || ev.title || "Event",
        tagline: source?.booking_card_tagline || taglineFallback,
        icon: source?.booking_card_icon ?? null,
        note: source?.booking_card_badge || null,
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

  const ticketCards = buildBookingCards((bookableEvents ?? []) as RawBookableEvent[]);
  const requestCards = REQUEST_CARDS;

  const renderCard = (card: BookingCard) => {
    const isGroup = card.count > 1;
    const Icon = cardIcon(card.icon);
    const isFullBadge = !isGroup && card.isFullyBooked;
    const badgeText = card.isFullyBooked
      ? "Full"
      : isGroup
      ? `${card.count} dates`
      : card.isFree
      ? "Free"
      : `£${card.paymentAmount!.toFixed(2)}`;

    return (
      <Link
        key={card.key}
        href={card.href}
        style={{ "--cc": card.colorHex } as React.CSSProperties}
        className={
          "group flex flex-col rounded-2xl border p-4 shadow-lg shadow-black/20 transition-all duration-300 hover:-translate-y-1 hover:border-white/30 active:scale-[0.99] sm:p-5 " +
          (card.isRequest
            ? "border-white/10 border-l-[3px] border-l-[#FDCC4B] bg-canvas-2 hover:bg-canvas-2/70"
            : "border-white/15 bg-white/5 hover:bg-white/12")
        }
      >
        <div className="flex gap-4">
          {card.date && (
            <DateChip date={new Date(card.date + "T00:00:00")} className="shrink-0" />
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <span className="line-clamp-2 inline-flex items-center gap-2 font-black text-xl leading-[0.95] tracking-tighter text-white uppercase sm:text-2xl">
                <Icon className="h-3.5 w-3.5 shrink-0 text-(--cc)" aria-hidden="true" />
                {card.title}
              </span>
              {!card.isRequest && (
                <span
                  className={
                    isFullBadge
                      ? "shrink-0 rounded-full border border-red-500/30 bg-red-500/20 px-2 py-0.5 font-black text-[9px] tracking-widest text-red-400 uppercase"
                      : "shrink-0 rounded-full border border-(--cc)/25 bg-(--cc)/12 px-2 py-0.5 font-black text-[9px] tracking-widest text-(--cc) uppercase"
                  }
                >
                  {badgeText}
                </span>
              )}
            </div>

            {card.note && (
              <span className="mt-1.5 block font-black text-[10px] tracking-widest text-(--cc) uppercase">
                {card.note}
              </span>
            )}

            {card.tagline && (
              <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-stone-400">
                {card.tagline}
              </p>
            )}
          </div>
        </div>

        <span className="mt-4 inline-flex items-center gap-1.5 border-t border-white/10 pt-3 font-black text-[10px] tracking-widest text-(--cc) uppercase transition-all group-hover:gap-2.5">
          {card.cta}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </Link>
    );
  };

  return (
    <main className="min-h-dvh w-full bg-canvas px-4 pb-12 text-ink-2 antialiased selection:bg-[#FDCC4B] selection:text-[#1a2008]">
      <PublicNav currentPath="/book" />

      <div className="mx-auto max-w-5xl py-8 sm:py-12">
        <PageHeader
          eyebrow="Bookings"
          title="Book Your Experience"
          subtitle="Tickets for what's on — or get in touch about playing our stage and private hire."
        />

        <div>
          <SectionHeading eyebrow="Tickets" title="Upcoming Events" />
          {ticketCards.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {ticketCards.map(renderCard)}
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
          <div className="mt-16 sm:mt-20">
            <SectionHeading eyebrow="Get in touch" title="Requests & Enquiries" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {requestCards.map(renderCard)}
            </div>
          </div>
        )}

        <div className="mt-16 flex flex-col items-center gap-2">
          <div className="flex items-center gap-3 text-stone-500">
            <div className="h-px w-6 bg-stone-500/40" />
            <span className="text-[9px] font-bold tracking-[0.4em] uppercase">Don Fenticas</span>
            <div className="h-px w-6 bg-stone-500/40" />
          </div>
          <p className="text-[8px] font-bold tracking-widest text-stone-500 uppercase">
            Licensed Venue · Please Drink Responsibly
          </p>
        </div>
      </div>
    </main>
  );
}