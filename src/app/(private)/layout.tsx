import type { Viewport } from "next";
import { createClient } from "@/lib/supabase/server";
import { buildAdminBookingGroups, partitionBookingGroups, type AdminBookingGroup, type AdminBookingGroupEvent } from "@/lib/admin-booking-groups";
import { getPendingRequestCounts } from "@/lib/request-counts";
import PrivateLayoutClient from "./private-layout-client";

export const viewport: Viewport = {
    themeColor: "#F4F1E8",
};

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
    const supabase = await createClient();
    const today = new Date().toISOString().split("T")[0];

    const [
        { data: { user } },
        { data: bookableEvents },
        pendingCounts,
    ] = await Promise.all([
        supabase.auth.getUser(),
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

    const allGroups = buildAdminBookingGroups((bookableEvents ?? []) as AdminBookingGroupEvent[])
        .sort((a, b) => a.label.localeCompare(b.label));
    const { guest: guestGroups } = partitionBookingGroups(allGroups);

    const toNav = (g: AdminBookingGroup) => ({
        label: g.label,
        href: g.href,
        icon: g.icon,
        color: g.badgeColor,
    });
    const guestNav = guestGroups.map(toNav);

    return (
        <PrivateLayoutClient
            employeeName={employeeName}
            employeeRole={employeeRole}
            guestNav={guestNav}
            pendingRequestsCount={pendingCounts.total}
            pendingBandCount={pendingCounts.band}
            pendingHireCount={pendingCounts.privateHire}
            pendingEnquiriesCount={pendingCounts.enquiries}
        >
            {children}
        </PrivateLayoutClient>
    );
}