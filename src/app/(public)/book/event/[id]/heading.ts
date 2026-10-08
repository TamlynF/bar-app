import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";

export async function eventHeading(id: string): Promise<{ title: string; when: string | null }> {
  const supabase = await createClient();
  const { data } = await supabase.from("events").select("title, date, start_time").eq("id", id).maybeSingle();
  const title = data?.title?.trim() || "Live at Don Fenticas";
  if (!data?.date) return { title, when: null };
  const day = format(new Date(`${data.date}T00:00:00`), "EEE d MMM");
  const time = data.start_time ? `, ${String(data.start_time).slice(0, 5)}` : "";
  return { title, when: `${day}${time}` };
}
