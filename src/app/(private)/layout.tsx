import type { Viewport } from "next";
import { createClient } from "@/lib/supabase/server";
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
        supabase
            .from("events")
            .select("id, title, date")
            .eq("is_active", true)
            .eq("is_bookable", true)
            .gte("date", today)
            .order("date", { ascending: true })
            .limit(10),
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

    const navEvents = (bookableEvents ?? []).map(e => ({
        id: e.id as number,
        title: (e.title as string) || "Event",
        date: e.date as string,
    }));

    const pendingRequestsCount =
        (pendingBandCount ?? 0) + (pendingHireCount ?? 0) + (pendingEnquiryCount ?? 0);

    return (
        <PrivateLayoutClient
            employeeName={employeeName}
            employeeRole={employeeRole}
            bookableEvents={navEvents}
            pendingRequestsCount={pendingRequestsCount}
        >
            {children}
        </PrivateLayoutClient>
    );
}