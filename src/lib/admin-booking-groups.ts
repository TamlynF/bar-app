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

type Named = { name: string | null; color?: string | null; booking_grouping?: string | null };

export type AdminBookingGroupEvent = {
  id: number;
  title: string | null;
  date: string;
  event_types: Named | Named[] | null;
  event_subtypes: Named | Named[] | null;
};

export type AdminBookingGroup = {
  key: string;
  /** Primary display label (event title / sub-type / category name), title-cased. */
  label: string;
  /** Secondary label (category name) for the hub cards; null when redundant. */
  typeLabel: string | null;
  href: string;
  count: number;
  badgeColor: string | null;
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
      out.push({
        key: `e-${ev.id}`,
        label: toTitleCase(ev.title) || "Event",
        typeLabel: toTitleCase(subName ?? typeName) || null,
        href: `/event-bookings/event/${ev.id}`,
        count: 1,
        badgeColor: s?.color ?? t.color ?? null,
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
            key: groupKey,
            label: toTitleCase(subName),
            typeLabel: toTitleCase(typeName) || null,
            href: `/event-bookings/general/${encodeURIComponent(typeName)}/${encodeURIComponent(subName!)}`,
            count: 1,
            badgeColor: s?.color ?? null,
          }
        : {
            key: groupKey,
            label: toTitleCase(typeName),
            typeLabel: null,
            href: `/event-bookings/general/${encodeURIComponent(typeName)}/${ALL_SUBTYPES}`,
            count: 1,
            badgeColor: t.color ?? null,
          };
    groups.set(groupKey, entry);
    out.push(entry);
  }

  return out;
}
