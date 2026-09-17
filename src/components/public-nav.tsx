import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getCompanyInfo, instagramHandle, instagramUrl } from "@/lib/company-info";
import { formatClock, toMinutes } from "@/lib/opening-hours";
import { PublicNavBar, type TopBarStatus } from "@/components/public-nav-bar";

const DOW_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

async function tonightStatus(): Promise<TopBarStatus | null> {
  const supabase = await createClient();
  const today = new Date();
  const [{ data: events }, info] = await Promise.all([
    supabase
      .from("events")
      .select("id, event_subtypes!inner(behavior)")
      .eq("is_active", true)
      .eq("date", format(today, "yyyy-MM-dd")),
    getCompanyInfo(),
  ]);
  const publicTonight = (events ?? []).filter((e) => {
    const st = Array.isArray(e.event_subtypes) ? e.event_subtypes[0] : e.event_subtypes;
    return st?.behavior !== "private";
  });
  if (publicTonight.length > 0) return { tone: "live", label: "Live tonight" };
  const open = toMinutes(info?.opening_hours?.[DOW_KEYS[today.getDay()]]?.open);
  return open == null ? null : { tone: "open", label: `Open from ${formatClock(open)}` };
}

export async function PublicNav({
  currentPath,
  overlay = false,
  ticker = true,
}: {
  currentPath?: string;
  overlay?: boolean;
  ticker?: boolean;
}) {
  const [info, status] = await Promise.all([getCompanyInfo(), tonightStatus()]);

  return (
    <PublicNavBar
      currentPath={currentPath}
      overlay={overlay}
      ticker={ticker}
      instagramUrl={instagramUrl(info?.instagram)}
      instagramHandle={instagramHandle(info?.instagram)}
      status={status}
    />
  );
}
