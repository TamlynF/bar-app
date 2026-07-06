export const dynamic = "force-dynamic";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { badgeClassFromColor, swatchHexFromColor } from "@/lib/event-type-colors";
import { cardIcon } from "@/lib/booking-card-icons";
import { buildAdminBookingGroups, partitionBookingGroups, type AdminBookingGroup, type AdminBookingGroupEvent } from "@/lib/admin-booking-groups";

export default async function EventsHubPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  // Fetch upcoming bookable events with their taxonomy metadata for grouping.
  // event_subtypes is a left join so events without a sub-type still appear.
  const { data: bookableEvents } = await supabase
    .from("events")
    .select("id, title, date, booking_card_title, booking_card_icon, event_types!inner(name, title, color, booking_grouping, booking_card_title, booking_card_icon), event_subtypes(name, title, color, behavior, booking_card_title, booking_card_icon)")
    .eq("is_active", true)
    .eq("is_bookable", true)
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(200);

  // Collapse events per each category's booking_grouping (per_event / per_subtype / per_type),
  // then split into guest bookings vs requests & enquiries (per_type music_act / private).
  const allGroups = buildAdminBookingGroups((bookableEvents ?? []) as AdminBookingGroupEvent[])
    .sort((a, b) => a.label.localeCompare(b.label));
  const { guest: guestGroups, requests: requestGroups } = partitionBookingGroups(allGroups);

  return (
    <div className="space-y-6 p-2 sm:p-8">
      <BookingGroupSection title="Requests & Enquiries" groups={requestGroups} />
      <BookingGroupSection title="Guest Bookings" groups={guestGroups} />
    </div>
  );
}

function BookingGroupSection({ title, groups }: { title: string; groups: AdminBookingGroup[] }) {
  if (groups.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="px-1 font-black text-[#5F624F] text-[11px] uppercase tracking-wide">
        {title}
      </h2>
      <div className="gap-3 grid grid-cols-1 sm:grid-cols-2">
        {groups.map((group) => {
          const badgeClasses = badgeClassFromColor(group.badgeColor);
          const colorHex = swatchHexFromColor(group.badgeColor) ?? "#5C4033";
          const Icon = cardIcon(group.icon);
          return (
            <Link
              key={group.key}
              href={group.href}
              className="group flex justify-between items-center bg-white shadow-sm hover:shadow-md p-3 border border-[#E6DFC8] hover:border-[#5C4033] rounded-3xl active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-4">
                <div
                  style={{ "--cc": colorHex } as React.CSSProperties}
                  className="flex items-center justify-center w-12 h-12 bg-(--cc)/15 rounded-2xl transition-transform shrink-0 group-hover:scale-110"
                >
                  <Icon className="w-6 h-6 text-(--cc)" />
                </div>
                <div className="flex flex-col min-w-0 text-left">
                  <span className="font-black text-[#1F1F1A] truncate uppercase leading-none tracking-tight">
                    {group.label}
                  </span>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {group.typeLabel && (
                      <span className="opacity-60 font-bold text-[#5F624F] text-[11px] uppercase tracking-wider">
                        {group.typeLabel}
                      </span>
                    )}
                    <span className={`text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded ${badgeClasses}`}>
                      {group.count} upcoming
                    </span>
                  </div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#E6DFC8] group-hover:text-[#5C4033] transition-colors" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}