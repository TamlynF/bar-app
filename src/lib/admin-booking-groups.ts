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
  label: string;
  typeLabel: string | null;
  href: string;
  count: number;
  badgeColor: string | null;
  icon: string | null;
  behavior: string | null;
  grouping: string;
};

const first = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

const toTitleCase = (s: string | null | undefined) =>
  !s ? "" : s.split(/[\s\-_]+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

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
    const mode = grouping === "per_subtype" && !subName ? "per_event" : grouping;

    if (mode === "per_event") {
      out.push({
        key: `e-${ev.id}`,
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

export function isRequestEnquiryGroup(g: AdminBookingGroup): boolean {
  return g.grouping === "per_type" && (g.behavior === "music_act" || g.behavior === "private");
}

export function partitionBookingGroups(groups: AdminBookingGroup[]): {
  guest: AdminBookingGroup[];
  requests: AdminBookingGroup[];
} {
  const guest: AdminBookingGroup[] = [];
  const requests: AdminBookingGroup[] = [];
  for (const g of groups) (isRequestEnquiryGroup(g) ? requests : guest).push(g);
  return { guest, requests };
}
