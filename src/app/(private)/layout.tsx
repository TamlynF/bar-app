import type { Viewport } from "next";
import { createClient } from "@/lib/supabase/server";
import PrivateLayoutClient from "./private-layout-client";

export const viewport: Viewport = {
    themeColor: "#F7F4EA",
};

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
    const supabase = await createClient();
    const today = new Date().toISOString().split("T")[0];

    const [{ data: { user } }, { data: bookableEvents }] = await Promise.all([
        supabase.auth.getUser(),
        supabase
            .from("events")
            .select("id, title, date")
            .eq("is_active", true)
            .eq("is_bookable", true)
            .gte("date", today)
            .order("date", { ascending: true })
            .limit(10),
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

    return <PrivateLayoutClient employeeName={employeeName} employeeRole={employeeRole} bookableEvents={navEvents}>{children}</PrivateLayoutClient>;
}
