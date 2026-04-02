import { createClient } from "@/lib/supabase/server";
import PrivateLayoutClient from "./private-layout-client";

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
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
    return <PrivateLayoutClient employeeName={employeeName} employeeRole={employeeRole}>{children}</PrivateLayoutClient>;
}
