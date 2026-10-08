import { createAdminClient } from "@/lib/supabase/admin";
import { parseArrival, type BookingArrival } from "@/lib/meta/preferred-channel";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ?via=instagram&c=<contact_channels.id> on a link staff sent from a chat:
   the form then knows the channel and the handle. A bare ?via= still records
   where the link was opened from. */
export async function readBookingArrival(params: { via?: string; c?: string }): Promise<BookingArrival | null> {
  const via = parseArrival(params.via);
  if (params.c && UUID_RE.test(params.c)) {
    const { data } = await createAdminClient()
      .from("contact_channels")
      .select("id, channel, handle")
      .eq("id", params.c)
      .maybeSingle();
    const channel = parseArrival(data?.channel);
    if (data && channel) return { channel, handle: (data.handle as string | null) ?? null, channelId: data.id as string };
  }
  return via ? { channel: via, handle: null, channelId: null } : null;
}
