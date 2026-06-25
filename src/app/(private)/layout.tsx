import type { Viewport } from "next";
import { createClient } from "@/lib/supabase/server";
import PrivateLayoutClient from "./private-layout-client";
import { buildAdminBookingGroups, type AdminBookingGroupEvent } from "@/lib/admin-booking-groups";

export const viewport: Viewport = {
    themeColor: "#F7F4EA",
};

// Cap on dynamic booking entries shown in the sidebar, so per_event categories
// with many upcoming dates don't make the nav unwieldy.
const MAX_NAV_BOOKINGS = 12;

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
    const supabase = await createClient();
    const today = new Date().toISOString().split("T")[0];

    const [{ data: { user } }, { data: bookableEvents }] = await Promise.all([
        supabase.auth.getUser(),
        supabase
            .from("events")
            .select("id, title, date, booking_card_title, booking_card_icon, event_types!inner(name, color, booking_grouping, booking_card_title, booking_card_icon), event_subtypes(name, color, booking_card_title, booking_card_icon)")
            .eq("is_active", true)
            .eq("is_bookable", true)
            .gte("date", today)
            .order("date", { ascending: true })
            .limit(200),
    ]);

    let employeeName = "";
    let employeeRole = "";
    if (user?.email) {
        const { data: emp } = await supabase
            .from("employees")
            .select("full_name, role")
            .eq("email", user.email)
            .maybeSingle();
        if (emp) {
            employeeName = emp.full_name;
            employeeRole = emp.role;
        }
    }

    // Collapse events per each category's booking_grouping for the sidebar nav.
    // Cap by soonest, then present alphabetically with each link's card icon + colour.
    const bookingNav = buildAdminBookingGroups((bookableEvents ?? []) as AdminBookingGroupEvent[])
        .slice(0, MAX_NAV_BOOKINGS)
        .map((g) => ({ label: g.label, href: g.href, icon: g.icon, color: g.badgeColor }))
        .sort((a, b) => a.label.localeCompare(b.label));

    return <PrivateLayoutClient employeeName={employeeName} employeeRole={employeeRole} bookingNav={bookingNav}>{children}</PrivateLayoutClient>;
}
