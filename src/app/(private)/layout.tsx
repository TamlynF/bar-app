import type { Viewport } from "next";
import { createClient } from "@/lib/supabase/server";
import { buildAdminBookingGroups, partitionBookingGroups, type AdminBookingGroup, type AdminBookingGroupEvent } from "@/lib/admin-booking-groups";
import PrivateLayoutClient from "./private-layout-client";

export const viewport: Viewport = {
    themeColor: "#F7F4EA",
};

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
    const supabase = await createClient();
    const today = new Date().toISOString().split("T")[0];

    const [
        { data: { user } },
        { data: bookableEvents },
        { count: pendingBandCount },
        { count: pendingHireCount },
        { count: pendingEnquiryCount },
    ] = await Promise.all([
        supabase.auth.getUser(),
        // Upcoming bookable events with taxonomy metadata, so the sidebar's
        // booking links are built from the same grouping logic as the hub.
        supabase
            .from("events")
            .select("id, title, date, booking_card_title, booking_card_icon, event_types!inner(name, title, color, booking_grouping, booking_card_title, booking_card_icon), event_subtypes(name, title, color, behavior, booking_card_title, booking_card_icon)")
            .eq("is_active", true)
            .eq("is_bookable", true)
            .gte("date", today)
            .order("date", { ascending: true })
            .limit(200),
        // Pending band applications — drives the amber Requests badge.
        supabase
            .from("band_booking_requests")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending"),
        // Pending private-hire enquiries.
        // NOTE: check this table name against your schema — it should be the
        // table your private-bookings pages query.
        supabase
            .from("private_hire_requests")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending"),
        // Pending general enquiries.
        supabase
            .from("enquiries")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending"),
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

    // Collapse events per each category's booking_grouping, then split into guest
    // bookings vs requests & enquiries — the same partition the bookings hub uses.
    const allGroups = buildAdminBookingGroups((bookableEvents ?? []) as AdminBookingGroupEvent[])
        .sort((a, b) => a.label.localeCompare(b.label));
    const { guest: guestGroups, requests: requestGroups } = partitionBookingGroups(allGroups);

    const toNav = (g: AdminBookingGroup) => ({
        label: g.label,
        href: g.href,
        icon: g.icon,
        color: g.badgeColor,
    });
    const guestNav = guestGroups.map(toNav);
    const requestNav = requestGroups.map(toNav);

    const pendingRequestsCount =
        (pendingBandCount ?? 0) + (pendingHireCount ?? 0) + (pendingEnquiryCount ?? 0);

    return (
        <PrivateLayoutClient
            employeeName={employeeName}
            employeeRole={employeeRole}
            guestNav={guestNav}
            requestNav={requestNav}
            pendingRequestsCount={pendingRequestsCount}
        >
            {children}
        </PrivateLayoutClient>
    );
}