import React from "react";
import Link from "next/link";
import { ArrowRight} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PublicNav } from "@/components/public-nav";
import { SectionHeading } from "@/components/editorial/section-heading";
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
  badge: string | null; // explicit card badge; null → dynamic badge
  colorHex: string; // tint for icon + badge
  date: string; // earliest upcoming date (YYYY-MM-DD)
  count: number; // number of events represented (1 = single event)
  isFree: boolean;
  isFullyBooked: boolean;
  paymentAmount: number | null;
  requestKind: RequestKind | null; // private / music_act → shown under Requests & Enquiries
};

const first = <T,>(v: T | T[] | null): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : v;

const GOLD = "#FDCC4B";

// Sub-types whose behaviour makes them an enquiry, not a ticketed booking. Their
// hub cards move to the Requests & Enquiries section and link to the enquiry form.
type RequestKind = "private" | "music_act";
const requestKindOf = (behavior: string | null | undefined): RequestKind | null =>
  behavior === "private" ? "private" : behavior === "music_act" ? "music_act" : null;
const requestHrefOf = (kind: RequestKind | null): string | null =>
  kind === "private" ? "/book/private" : kind === "music_act" ? "/book/band" : null;

/** Collapse bookable events into hub cards per each category's booking_grouping. */
function buildBookingCards(events: RawBookableEvent[]): BookingCard[] {
  const cards: BookingCard[] = [];
  const groups = new Map<string, BookingCard>();

  for (const ev of events) {
    const type = first(ev.event_types);
    const subtype = first(ev.event_subtypes);
    const grouping = type?.booking_grouping ?? "per_event";
    const isFree = !ev.payment_amount || ev.payment_amount === 0;

    // per_subtype needs a subtype; without one, fall back to a single-event card.
    const mode = grouping === "per_subtype" && !subtype ? "per_event" : grouping;

    // Pick the row that owns this card's branding, and the colour it tints with.
    const source: CardSource | null = mode === "per_type" ? type : mode === "per_subtype" ? subtype : ev;
    const colorKey = mode === "per_type" ? type?.color : subtype?.color;
    const colorHex = swatchHexFromColor(colorKey) ?? GOLD;
    const taglineFallback = subtype?.tagline || ev.tagline || "";
    // private / music_act sub-types are enquiries — link to the enquiry form.
    const requestKind = requestKindOf(subtype?.behavior);
    const requestHref = requestHrefOf(requestKind);

    if (mode === "per_event") {
      cards.push({
        key: `e-${ev.id}`,
        href: requestHref ?? `/book/event/${ev.id}`,
        title: source?.booking_card_title || ev.title || "Event",
        tagline: source?.booking_card_tagline || taglineFallback,
        icon: source?.booking_card_icon ?? null,
        badge: source?.booking_card_badge || null,
        colorHex,
        date: ev.date,
        count: 1,
        isFree,
        isFullyBooked: !!ev.is_fully_booked,
        paymentAmount: ev.payment_amount ?? null,
        requestKind,
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
      // events are date-ascending, so the first seen date is the earliest.
      existing.isFullyBooked = existing.isFullyBooked && !!ev.is_fully_booked;
      continue;
    }
    const fallbackTitle = (mode === "per_subtype" ? subtype!.name : type?.name) || ev.title || "Events";
    const card: BookingCard = {
      key: groupKey,
      href:
        requestHref ??
        (mode === "per_subtype"
          ? `/book/group/subtype/${subtype!.id}`
          : `/book/group/type/${ev.event_types_id}`),
      title: source?.booking_card_title || fallbackTitle,
      tagline: source?.booking_card_tagline || taglineFallback,
      icon: source?.booking_card_icon ?? null,
      badge: source?.booking_card_badge || null,
      colorHex,
      date: ev.date,
      count: 1,
      isFree,
      isFullyBooked: !!ev.is_fully_booked,
      paymentAmount: ev.payment_amount ?? null,
      requestKind,
    };
    groups.set(groupKey, card);
    cards.push(card);
  }

  return cards.sort((a, b) => a.date.localeCompare(b.date));
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

  const cards = buildBookingCards((bookableEvents ?? []) as RawBookableEvent[]);
  const ticketCards = cards.filter((c) => !c.requestKind);
  const requestCards = cards.filter((c) => c.requestKind);

  const renderCard = (card: BookingCard) => {
    const dateStr = new Date(card.date + "T00:00:00").toLocaleDateString("en-GB", {
      weekday: "short", day: "numeric", month: "short",
    });
    const isGroup = card.count > 1;
    const Icon = cardIcon(card.icon);
    // Explicit card badge wins; otherwise the dynamic count / price / Full badge.
    const badgeText = card.badge
      ? card.badge
      : isGroup
      ? `${card.count} dates`
      : card.isFullyBooked
      ? "Full"
      : card.isFree
      ? "Free"
      : `£${card.paymentAmount!.toFixed(2)}`;
    const isFullBadge = !card.badge && !isGroup && card.isFullyBooked;
    return (
      <Link
        key={card.key}
        href={card.href}
        style={{ "--cc": card.colorHex } as React.CSSProperties}
        className="group flex flex-col bg-white/5 hover:bg-white/12 shadow-black/20 shadow-lg p-6 border border-white/15 hover:border-white/30 rounded-2xl min-h-44 active:scale-[0.99] transition-all hover:-translate-y-1 duration-300"
      >
        <div className="flex justify-between items-start gap-3 mb-5">
          <div className="flex items-center justify-center w-8 h-8 bg-(--cc)/12 rounded-lg border-(--cc)/25 shrink-0 border">
            <Icon className="w-4 h-4 text-(--cc)" />
          </div>
          <span
            className={
              isFullBadge
                ? "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30"
                : "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-(--cc)/12 text-(--cc) border border-(--cc)/25"
            }
          >
            {badgeText}
          </span>
        </div>

        <span className="font-black text-white text-2xl sm:text-3xl uppercase line-clamp-2 leading-[0.95] tracking-tighter">
          {card.title}
        </span>
        {card.tagline && (
          <p className="mt-2 text-stone-400 text-xs line-clamp-2 leading-relaxed">{card.tagline}</p>
        )}

        <span className="inline-flex items-center gap-1.5 mt-auto pt-4 text-[10px] font-black tracking-widest text-(--cc) transition-all uppercase group-hover:gap-2.5">
          {card.requestKind ? "Enquire now" : isGroup ? `Next: ${dateStr}` : dateStr}
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </span>
      </Link>
    );
  };

  return (
    <main className="bg-[#26300D] selection:bg-[#fdcc4b] px-4 pb-12 w-full min-h-dvh selection:text-[#26300D]">
      <style dangerouslySetInnerHTML={{
        __html: `html, body { background-color: #26300D !important; margin: 0; padding: 0; overflow-x: hidden; }`
      }} />

      <PublicNav currentPath="/book" />

      <div className="mx-auto pt-1 sm:pt-1 max-w-5xl">
        {/* Upcoming Bookable Events (ticketed) */}
        {ticketCards.length > 0 && (
          <div className="mt-1 sm:mt-1">
            <SectionHeading eyebrow="Tickets" title="Upcoming Events" />
            <div className="gap-4 grid grid-cols-1 sm:grid-cols-2">
              {ticketCards.map(renderCard)}
            </div>
          </div>
        )}

        {/* Requests & Enquiries (private hire + band applications) */}
        {requestCards.length > 0 && (
          <div className="mt-16 sm:mt-20">
            <SectionHeading eyebrow="Get in touch" title="Requests & Enquiries" />
            <div className="gap-4 grid grid-cols-1 sm:grid-cols-2">
              {requestCards.map(renderCard)}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-col items-center gap-2 mt-16">
          <div className="flex items-center gap-3 text-stone-800">
            <div className="bg-stone-800/50 w-6 h-px" />
            <span className="font-bold text-[9px] uppercase tracking-[0.4em]">Don Fenticas</span>
            <div className="bg-stone-800/50 w-6 h-px" />
          </div>
          <p className="opacity-40 font-bold text-[8px] text-stone-700 uppercase tracking-widest">
            Licensed Venue · Please Drink Responsibly
          </p>
        </div>
      </div>
    </main>
  );
}