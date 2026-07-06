// Builds the admin event-bookings navigation entries (sidebar + bookings hub)
// from upcoming bookable events, honouring each category's `booking_grouping`:
//
//   'per_event'   — one entry per event        → /event-bookings/event/[id]
//   'per_subtype' — one entry per sub-type     → /event-bookings/general/[type]/[subtype]
//   'per_type'    — one entry per category     → /event-bookings/general/[type]/__all__
//
// Mirrors the public hub's `buildBookingCards` so the admin and public surfaces
// collapse the same events the same way.

import { isBookingGrouping, ALL_SUBTYPES } from "./booking-grouping";

type Named = {
  name: string | null;
  title?: string | null;
  color?: string | null;
  booking_grouping?: string | null;
  booking_card_title?: string | null;
  booking_card_icon?: string | null;
  behavior?: string | null;
};

export type AdminBookingGroupEvent = {
  id: number;
  title: string | null;
  date: string;
  booking_card_title?: string | null;
  booking_card_icon?: string | null;
  event_types: Named | Named[] | null;
  event_subtypes: Named | Named[] | null;
};

export type AdminBookingGroup = {
  key: string;
  /** Primary display label — the booking_card_title of the owning row, else a title-cased fallback. */
  label: string;
  /** Secondary label (category name) for the hub cards; null when redundant. */
  typeLabel: string | null;
  href: string;
  count: number;
  badgeColor: string | null;
  /** Lucide icon name (booking_card_icon) from the owning row; null → default glyph. */
  icon: string | null;
  /** Sub-type behaviour of the owning/first event (music_act, private, quiz…); null when unknown. */
  behavior: string | null;
  /** Resolved grouping mode used to build this entry (per_event | per_subtype | per_type). */
  grouping: string;
};

const first = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

const toTitleCase = (s: string | null | undefined) =>
  !s ? "" : s.split(/[\s\-_]+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

/** Collapse upcoming bookable events into admin booking entries per grouping mode. */
export function buildAdminBookingGroups(events: AdminBookingGroupEvent[]): AdminBookingGroup[] {
  const out: AdminBookingGroup[] = [];
  const groups = new Map<string, AdminBookingGroup>();

  for (const ev of events) {
    const t = first(ev.event_types);
    const s = first(ev.event_subtypes);
    const typeName = t?.name;
    if (!typeName) continue;
    const subName = s?.name ?? null;

    const grouping = isBookingGrouping(t.booking_grouping) ? t.booking_grouping : "per_event";
    // per_subtype needs a sub-type; without one, fall back to a single-event entry.
    const mode = grouping === "per_subtype" && !subName ? "per_event" : grouping;

    if (mode === "per_event") {
      // per_event → branding from the event row itself.
      out.push({
        key: `e-${ev.id}`,
        // per_event → label from the event's own title.
        label: toTitleCase(ev.title) || ev.booking_card_title || "Event",
        typeLabel: toTitleCase(subName ?? typeName) || null,
        href: `/event-bookings/event/${ev.id}`,
        count: 1,
        badgeColor: s?.color ?? t.color ?? null,
        icon: ev.booking_card_icon ?? null,
        behavior: s?.behavior ?? null,
        grouping: "per_event",
      });
      continue;
    }

    const groupKey =
      mode === "per_subtype" ? `s-${typeName}__${subName}` : `t-${typeName}`;
    const existing = groups.get(groupKey);
    if (existing) {
      existing.count += 1;
      continue;
    }

    const entry: AdminBookingGroup =
      mode === "per_subtype"
        ? {
            // per_subtype → label from the sub-type's title.
            key: groupKey,
            label: s?.title || s?.booking_card_title || toTitleCase(subName),
            typeLabel: toTitleCase(typeName) || null,
            href: `/event-bookings/general/${encodeURIComponent(typeName)}/${encodeURIComponent(subName!)}`,
            count: 1,
            badgeColor: s?.color ?? null,
            icon: s?.booking_card_icon ?? null,
            behavior: s?.behavior ?? null,
            grouping: "per_subtype",
          }
        : {
            // per_type → label from the category's title.
            key: groupKey,
            label: t.title || t.booking_card_title || toTitleCase(typeName),
            typeLabel: null,
            href: `/event-bookings/general/${encodeURIComponent(typeName)}/${ALL_SUBTYPES}`,
            count: 1,
            badgeColor: t.color ?? null,
            icon: t.booking_card_icon ?? null,
            behavior: s?.behavior ?? null,
            grouping: "per_type",
          };
    groups.set(groupKey, entry);
    out.push(entry);
  }

  return out;
}

/**
 * A "request / enquiry" booking entry: a per_type category whose sub-type behaviour
 * is a music act or private hire (the review-pipeline surfaces). Everything else is
 * a guest booking.
 */
export function isRequestEnquiryGroup(g: AdminBookingGroup): boolean {
  return g.grouping === "per_type" && (g.behavior === "music_act" || g.behavior === "private");
}

/** Split booking groups into guest bookings vs requests & enquiries. */
export function partitionBookingGroups(groups: AdminBookingGroup[]): {
  guest: AdminBookingGroup[];
  requests: AdminBookingGroup[];
} {
  const guest: AdminBookingGroup[] = [];
  const requests: AdminBookingGroup[] = [];
  for (const g of groups) (isRequestEnquiryGroup(g) ? requests : guest).push(g);
  return { guest, requests };
}
