export const dynamic = "force-dynamic";

import Link from "next/link";
import { ChevronRight, Inbox, Tickets } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPendingRequestCounts } from "@/lib/request-counts";
import { buildAdminBookingGroups, partitionBookingGroups, type AdminBookingGroupEvent } from "@/lib/admin-booking-groups";

export default async function GuestsHubPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  const [{ data: bookableEvents }, counts] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, date, booking_card_title, booking_card_icon, event_types!inner(name, title, color, booking_grouping, booking_card_title, booking_card_icon), event_subtypes(name, title, color, behavior, booking_card_title, booking_card_icon)")
      .eq("is_active", true)
      .eq("is_bookable", true)
      .gte("date", today)
      .order("date", { ascending: true })
      .limit(200),
    getPendingRequestCounts(supabase),
  ]);

  const { guest: guestGroups } = partitionBookingGroups(
    buildAdminBookingGroups((bookableEvents ?? []) as AdminBookingGroupEvent[])
  );
  const upcomingCount = guestGroups.reduce((total, group) => total + group.count, 0);

  const sections = [
    {
      title: "Bookings",
      description: "Tables and tickets guests have booked, by event",
      href: "/event-bookings",
      icon: Tickets,
      meta: upcomingCount > 0 ? `${upcomingCount} upcoming ${upcomingCount === 1 ? "event" : "events"}` : "Nothing upcoming",
      badge: 0,
    },
    {
      title: "Requests",
      description: "Band applications, private hire and enquiries",
      href: "/requests",
      icon: Inbox,
      meta: counts.total > 0 ? `${counts.total} waiting on a decision` : "Nothing waiting",
      badge: counts.total,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-3 p-4 sm:p-6">
      <p className="text-sm leading-normal text-admin-muted">
        Where would you like to go?
      </p>

      {sections.map(section => (
        <Link
          key={section.href}
          href={section.href}
          className="group relative flex items-center gap-4 rounded-2xl border border-admin-line bg-admin-card p-4 shadow-sm transition-all hover:border-admin-primary hover:shadow-md active:scale-[0.98]"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-admin-primary-soft text-admin-primary">
            <section.icon className="h-5.5 w-5.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-bold tracking-tight text-admin-ink">{section.title}</span>
            <span className="block truncate text-[13px] font-medium text-admin-muted">{section.description}</span>
            <span className="mt-1.5 inline-flex items-center rounded-lg border border-admin-line bg-admin-surface px-2 py-1 text-[11px] font-semibold text-admin-muted tabular-nums">
              {section.meta}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-admin-muted group-hover:text-admin-primary" />

          {section.badge > 0 && (
            <span
              aria-label={`${section.badge} awaiting action`}
              className="absolute -top-2 -right-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-admin-error px-1.5 text-[11px] font-semibold text-white shadow-sm ring-2 ring-admin-bg tabular-nums"
            >
              {section.badge > 99 ? "99+" : section.badge}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}
