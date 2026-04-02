import { createClient } from "@/lib/supabase/server";
import PrivateLayoutClient from "./private-layout-client";

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    let employeeName = "";
    if (user?.email) {
        const { data: emp } = await supabase
            .from("employees")
            .select("full_name")
            .eq("email", user.email)
            .maybeSingle();
        if (emp) employeeName = emp.full_name;
    }
    return <PrivateLayoutClient employeeName={employeeName}>{children}</PrivateLayoutClient>;
}
