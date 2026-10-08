import { createClient } from "@/lib/supabase/server";
import CustomersClient, { type ContactRecord } from "./customers-client";
import { readContactActivity } from "./activity";

export default async function CustomersPage() {
  const supabase = await createClient();

  const [{ data: contacts, error }, { data: employees }, { data: unreadRows }, { data: channelRows }] = await Promise.all([
    supabase.from("contacts").select("*").order("full_name", { ascending: true }),
    supabase.from("employees").select("id, full_name").order("full_name", { ascending: true }),
    supabase
      .from("email_messages")
      .select("contact_id")
      .eq("direction", "inbound")
      .is("read_at", null)
      .not("contact_id", "is", null),
    supabase.from("contact_channels").select("contact_id, profile_pic_url").not("profile_pic_url", "is", null),
  ]);

  if (error) {
    console.error("Error fetching contacts:", error);
  }

  const avatarByContact: Record<number, string> = {};
  for (const c of channelRows ?? []) {
    if (c.contact_id != null && c.profile_pic_url && !avatarByContact[c.contact_id]) avatarByContact[c.contact_id] = c.profile_pic_url;
  }
  const rows = ((contacts ?? []) as ContactRecord[]).map((c) => ({ ...c, avatar_url: avatarByContact[c.id] ?? null }));
  const activity = await readContactActivity(
    supabase,
    rows.map((c) => ({ id: c.id, email: c.email })),
  );

  const unreadEmails: Record<number, number> = {};
  for (const r of unreadRows ?? []) {
    const id = r.contact_id as number;
    unreadEmails[id] = (unreadEmails[id] ?? 0) + 1;
  }

  return (
    <CustomersClient
      unreadEmails={unreadEmails}
      initialContacts={rows}
      employees={employees ?? []}
      activity={activity}
    />
  );
}
