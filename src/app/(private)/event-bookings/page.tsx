export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  Trophy,
  Music,
  Lock,
  ChevronRight,
  Speaker,
  CalendarDays,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { badgeClassFromColor, swatchClassFromColor } from "@/lib/event-type-colors";

const eventBookingItems = [
  {
    title: "Bingo Bookings",
    description: "Manage bingo teams, seating and scores",
    href: "/event-bookings/bingo-bookings",
    icon: Speaker,
    color: "bg-purple-50 text-purple-600",
  },
  {
    title: "Music Bookings",
    description: "Schedule bands and live entertainment",
    href: "/event-bookings/music-bookings",
    icon: Music,
    color: "bg-sky-50 text-sky-600",
  },
  {
    title: "Private Event Bookings",
    description: "Enquiries and venue hire pipeline",
    href: "/event-bookings/private-bookings",
    icon: Lock,
    color: "bg-green-50 text-green-600",
  },
   {
    title: "Quiz Bookings",
    description: "Manage quiz teams, seating and scores",
    href: "/event-bookings/quiz-bookings",
    icon: Trophy,
    color: "bg-amber-50 text-amber-600",
  },
];

function toTitleCase(str: string) {
  return str.split(/[\s\-_]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

type EventTypeRow = { type: string; sub_type: string; badge_color?: string | null; type_color?: string | null };

export default async function EventsHubPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  // Fetch upcoming bookable events with their event type metadata for grouping
  const { data: bookableEvents } = await supabase
    .from("events")
    .select("id, date, event_types!inner(type, sub_type, badge_color, type_color)")
    .eq("is_active", true)
    .eq("is_bookable", true)
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(200);

  // Group by type + sub_type
  type GroupEntry = { type: string; subType: string; badgeColor: string | null; typeColor: string | null; count: number };
  const groupMap = new Map<string, GroupEntry>();
  for (const ev of bookableEvents ?? []) {
    const et = (Array.isArray(ev.event_types) ? ev.event_types[0] : ev.event_types) as EventTypeRow | null;
    if (!et) continue;
    const key = `${et.type}__${et.sub_type}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        type: et.type,
        subType: et.sub_type,
        badgeColor: et.badge_color ?? null,
        typeColor: et.type_color ?? null,
        count: 0,
      });
    }
    groupMap.get(key)!.count++;
  }
  const generalGroups = Array.from(groupMap.values());

  return (
    <div className="p-2 sm:p-8 space-y-4">
      {/* Specialised booking sections */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {eventBookingItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex items-center justify-between p-3 bg-white border border-[#E6DFC8] rounded-3xl shadow-sm hover:border-[#5C4033] hover:shadow-md transition-all active:scale-[0.98]"
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl ${item.color} flex items-center justify-center shrink-0 transition-transform group-hover:scale-110`}>
                <item.icon className="w-6 h-6" />
              </div>
              <div className="flex flex-col text-left">
                <span className="font-black text-[#1F1F1A] uppercase tracking-tight leading-none">
                  {item.title}
                </span>
                <span className="text-[11px] text-[#5F624F] font-bold opacity-60 uppercase mt-1.5 tracking-wider">
                  {item.description}
                </span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#E6DFC8] group-hover:text-[#5C4033] transition-colors" />
          </Link>
        ))}
      </div>

      {/* General event type groups */}
      {generalGroups.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-[11px] font-black uppercase tracking-wide text-[#5F624F] px-1">
            General Events
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {generalGroups.map((group) => {
              const swatchClass = swatchClassFromColor(group.badgeColor);
              const badgeClasses = badgeClassFromColor(group.badgeColor);
              return (
                <Link
                  key={`${group.type}__${group.subType}`}
                  href={`/event-bookings/general/${encodeURIComponent(group.type)}/${encodeURIComponent(group.subType)}`}
                  className="group flex items-center justify-between p-3 bg-white border border-[#E6DFC8] rounded-3xl shadow-sm hover:border-[#5C4033] hover:shadow-md transition-all active:scale-[0.98]"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${swatchClass}`}>
                      <CalendarDays className="w-6 h-6 text-[#5C4033]" />
                    </div>
                    <div className="flex flex-col text-left min-w-0">
                      <span className="font-black text-[#1F1F1A] uppercase tracking-tight leading-none truncate">
                        {toTitleCase(group.subType)}
                      </span>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="text-[11px] text-[#5F624F] font-bold opacity-60 uppercase tracking-wider">
                          {toTitleCase(group.type)}
                        </span>
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
        </div>
      )}
    </div>
  );
}