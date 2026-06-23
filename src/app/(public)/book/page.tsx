import React from "react";
import Link from "next/link";
import { Trophy, Music, Building2, ArrowRight, Disc3 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PublicNav } from "@/components/public-nav";
import { SectionHeading } from "@/components/editorial/section-heading";
import { cardIcon } from "@/lib/booking-card-icons";
import { swatchHexFromColor } from "@/lib/event-type-colors";

export const metadata = {
  title: "Book | Don Fenticas",
  description: "Book a table, a band slot, or a private event at Don Fenticas.",
};

const bookingOptions = [
  {
    href: "/book/quiz",
    icon: Trophy,
    label: "Quiz Night",
    description: "Book a table for our weekly quiz night. Eight rounds, great prizes, and happy hour vibes.",
    badge: "Thursdays",
    iconClass: "icon-quiz",
    iconColor: "icon-color-quiz",
    badgeClass: "badge-quiz",
  },
  {
    href: "/book/bingo",
    icon: Disc3,
    label: "Music Bingo",
    description: "Book your spot for Music Bingo night. Tickets paid upfront — don't miss out!",
    badge: "Book",
    iconClass: "icon-bingo",
    iconColor: "icon-color-bingo",
    badgeClass: "badge-bingo",
  },
  {
    href: "/book/band",
    icon: Music,
    label: "Book the Stage",
    description: "Apply to perform live at Don Fenticas. Submit your details and we'll be in touch.",
    badge: "Apply Now",
    iconClass: "icon-band",
    iconColor: "icon-color-band",
    badgeClass: "badge-band",
  },
  {
    href: "/book/private",
    icon: Building2,
    label: "Private Hire",
    description: "Host your birthday, corporate event, or special occasion at our venue.",
    badge: "Enquire Now",
    iconClass: "icon-hire",
    iconColor: "icon-color-hire",
    badgeClass: "badge-hire",
  },
];

type CardSource = {
  booking_card_title: string | null;
  booking_card_tagline: string | null;
  booking_card_icon: string | null;
  booking_card_badge: string | null;
};

type RawType = { id: number; name: string | null; color: string | null; booking_grouping: string | null } & CardSource;
type RawSubtype = { id: number; name: string | null; color: string | null; tagline: string | null } & CardSource;

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
};

const first = <T,>(v: T | T[] | null): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : v;

const GOLD = "#FDCC4B";

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

    if (mode === "per_event") {
      cards.push({
        key: `e-${ev.id}`,
        href: `/book/event/${ev.id}`,
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
        mode === "per_subtype"
          ? `/book/group/subtype/${subtype!.id}`
          : `/book/group/type/${ev.event_types_id}`,
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
      "id, date, title, tagline, payment_amount, is_fully_booked, event_types_id, event_subtypes_id, booking_card_title, booking_card_tagline, booking_card_icon, booking_card_badge, event_types!inner(id, name, color, booking_grouping, booking_card_title, booking_card_tagline, booking_card_icon, booking_card_badge), event_subtypes(id, name, color, tagline, booking_card_title, booking_card_tagline, booking_card_icon, booking_card_badge)"
    )
    .eq("is_active", true)
    .eq("is_bookable", true)
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(50);

  const cards = buildBookingCards((bookableEvents ?? []) as RawBookableEvent[]);

  return (
    <main className="min-h-dvh w-full bg-[#26300D] px-4 pb-12 selection:bg-[#fdcc4b] selection:text-[#26300D]">
      <style dangerouslySetInnerHTML={{
        __html: `html, body { background-color: #26300D !important; margin: 0; padding: 0; overflow-x: hidden; }`
      }} />

      <PublicNav currentPath="/book" />

      <div className="max-w-5xl mx-auto pt-6 sm:pt-10">
        {/* Header — H1 is the page's purpose, not the bar name */}
        <SectionHeading eyebrow="Reservations & bookings" title="Book" />

        {/* Booking Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {bookingOptions.map((opt) => (
            <Link
              key={opt.href}
              href={opt.href}
              className="group flex flex-col bg-white/5 hover:bg-white/12 border border-white/15 hover:border-white/30 rounded-2xl p-6 shadow-lg shadow-black/20 transition-all duration-300 hover:-translate-y-1 active:scale-[0.99] min-h-44"
            >
              <div className="flex items-start justify-between gap-3 mb-5">
                <div className={`shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center ${opt.iconClass}`}>
                  <opt.icon className={`w-6 h-6 ${opt.iconColor}`} />
                </div>
                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${opt.badgeClass}`}>
                  {opt.badge}
                </span>
              </div>

              <span className="text-white font-black uppercase tracking-tighter leading-[0.95] text-2xl sm:text-3xl">
                {opt.label}
              </span>
              <p className="text-stone-400 text-xs leading-relaxed mt-2 line-clamp-2">{opt.description}</p>

              <span className="mt-auto pt-4 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#FDCC4B] group-hover:gap-2.5 transition-all">
                Book now
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>

        {/* Upcoming Bookable Events */}
        {cards.length > 0 && (
          <div className="mt-16 sm:mt-20">
            <SectionHeading eyebrow="Tickets" title="Upcoming Events" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {cards.map((card) => {
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
                    className="group flex flex-col bg-white/5 hover:bg-white/12 border border-white/15 hover:border-white/30 rounded-2xl p-6 shadow-lg shadow-black/20 transition-all duration-300 hover:-translate-y-1 active:scale-[0.99] min-h-44"
                  >
                    <div className="flex items-start justify-between gap-3 mb-5">
                      <div className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center bg-(--cc)/12 border border-(--cc)/25">
                        <Icon className="w-6 h-6 text-(--cc)" />
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

                    <span className="text-white font-black uppercase tracking-tighter leading-[0.95] text-2xl sm:text-3xl line-clamp-2">
                      {card.title}
                    </span>
                    {card.tagline && (
                      <p className="text-stone-400 text-xs leading-relaxed mt-2 line-clamp-2">{card.tagline}</p>
                    )}

                    <span className="mt-auto pt-4 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-(--cc) group-hover:gap-2.5 transition-all">
                      {isGroup ? `Next: ${dateStr}` : dateStr}
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-16 flex flex-col items-center gap-2">
          <div className="flex items-center gap-3 text-stone-800">
            <div className="h-px w-6 bg-stone-800/50" />
            <span className="text-[9px] font-bold uppercase tracking-[0.4em]">Don Fenticas</span>
            <div className="h-px w-6 bg-stone-800/50" />
          </div>
          <p className="text-[8px] text-stone-700 uppercase tracking-widest font-bold opacity-40">
            Licensed Venue · Please Drink Responsibly
          </p>
        </div>
      </div>
    </main>
  );
}