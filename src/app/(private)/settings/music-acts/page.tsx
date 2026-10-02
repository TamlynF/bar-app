import { createClient } from "@/lib/supabase/server";
import MusicActsClient, { type ActCounts, type MusicActWithContact } from "./music-acts-client";
import { getVideoUploadLimitBytes } from "@/lib/video-upload-limit-data";

export const dynamic = "force-dynamic";

export default async function MusicActsPage() {
  const supabase = await createClient();

  const [
    { data: acts, error },
    { data: bookings },
    { data: subtypes },
    { data: employees },
    maxVideoBytes,
    { data: unreadRows },
  ] =
    await Promise.all([
      supabase
        .from("music_acts")
        .select("*, contact:contacts(id, full_name, email, phone_no)")
        .order("is_favorite", { ascending: false })
        .order("group_name", { ascending: true }),
      supabase
        .from("band_booking_requests")
        .select("music_acts_id, linked_event:events!band_booking_requests_event_id_fkey(date)")
        .eq("status", "booked"),
      supabase
        .from("event_subtypes")
        .select("name")
        .eq("behavior", "music_act")
        .order("name", { ascending: true }),
      supabase.from("employees").select("id, full_name").order("full_name", { ascending: true }),
      getVideoUploadLimitBytes(),
      supabase
        .from("email_messages")
        .select("music_act_id")
        .eq("direction", "inbound")
        .is("read_at", null)
        .not("music_act_id", "is", null),
    ]);

  if (error) console.error("Error fetching music acts:", error);

  const today = new Date().toISOString().split("T")[0];
  const counts: Record<string, ActCounts> = {};
  for (const b of bookings ?? []) {
    const id = b.music_acts_id as string | null;
    if (!id) continue;
    const c = (counts[id] ??= { bookings: 0, completed: 0, upcoming: 0 });
    c.bookings += 1;
    const ev = Array.isArray(b.linked_event) ? b.linked_event[0] : b.linked_event;
    const date = (ev as { date: string | null } | null)?.date ?? null;
    if (date && date < today) c.completed += 1;
    else if (date) c.upcoming += 1;
  }

  const unreadEmails: Record<string, number> = {};
  for (const r of unreadRows ?? []) {
    const id = r.music_act_id as string;
    unreadEmails[id] = (unreadEmails[id] ?? 0) + 1;
  }

  const typeOptions = (subtypes ?? [])
    .map((s) => (s.name as string | null)?.trim())
    .filter((n): n is string => !!n);

  return (
    <MusicActsClient
      initialActs={(acts as MusicActWithContact[]) || []}
      counts={counts}
      unreadEmails={unreadEmails}
      typeOptions={typeOptions}
      employees={employees ?? []}
      maxVideoBytes={maxVideoBytes}
    />
  );
}
