import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { channelAddress, instagramHandle, type MetaChannel } from "@/lib/meta/channels";
import { fetchMetaProfile, type InboundMetaMessage, type MetaEnv } from "@/lib/meta/messaging";
import { escapeLike } from "@/lib/email/correspondence-data";

type Identity = {
  contactId: number | null;
  bandRequestId: string | null;
  musicActId: string | null;
  handle: string | null;
  name: string | null;
};

type ChannelRow = { contact_id: number; handle: string | null; display_name: string | null };

async function knownChannel(admin: SupabaseClient, channel: MetaChannel, externalId: string): Promise<ChannelRow | null> {
  const { data } = await admin
    .from("contact_channels")
    .select("contact_id, handle, display_name")
    .eq("channel", channel)
    .eq("external_id", externalId)
    .maybeSingle();
  return (data as ChannelRow | null) ?? null;
}

type RequestRow = { id: string; contact_id: number | null; music_acts_id: string | null };

/* The newest application whose Instagram link carries this username. An act
   who DMs from the account on their application is matched without staff
   doing anything. */
async function requestByInstagram(admin: SupabaseClient, username: string): Promise<RequestRow | null> {
  const { data } = await admin
    .from("band_booking_requests")
    .select("id, contact_id, music_acts_id, social_links")
    .ilike("social_links->>instagram", `%${escapeLike(username)}%`)
    .order("created_at", { ascending: false })
    .limit(5);
  const row = (data ?? []).find(
    (r) => instagramHandle((r.social_links as { instagram?: string } | null)?.instagram) === username
  );
  return row ? { id: row.id as string, contact_id: row.contact_id as number | null, music_acts_id: row.music_acts_id as string | null } : null;
}

/* A Messenger sender only gives a name, so it is matched to a contact when
   exactly one contact has that name - anything looser would file one act's
   chat under another. */
async function contactByName(admin: SupabaseClient, name: string): Promise<number | null> {
  const { data } = await admin.from("contacts").select("id").ilike("full_name", escapeLike(name)).limit(2);
  return data?.length === 1 ? (data[0].id as number) : null;
}

async function latestRequestForContact(admin: SupabaseClient, contactId: number): Promise<RequestRow | null> {
  const { data } = await admin
    .from("band_booking_requests")
    .select("id, contact_id, music_acts_id")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as RequestRow | null) ?? null;
}

async function identify(admin: SupabaseClient, env: MetaEnv, m: InboundMetaMessage): Promise<Identity> {
  const known = await knownChannel(admin, m.channel, m.senderId);
  if (known) {
    const request = await latestRequestForContact(admin, known.contact_id);
    return {
      contactId: known.contact_id,
      bandRequestId: request?.id ?? null,
      musicActId: request?.music_acts_id ?? null,
      handle: known.handle,
      name: known.display_name,
    };
  }

  const profile = await fetchMetaProfile(env, m.channel, m.senderId);
  const handle = m.channel === "instagram" ? instagramHandle(profile.username) : null;

  if (handle) {
    const request = await requestByInstagram(admin, handle);
    if (request) {
      return { contactId: request.contact_id, bandRequestId: request.id, musicActId: request.music_acts_id, handle, name: profile.name };
    }
  }

  const contactId = profile.name ? await contactByName(admin, profile.name) : null;
  const request = contactId ? await latestRequestForContact(admin, contactId) : null;
  return { contactId, bandRequestId: request?.id ?? null, musicActId: request?.music_acts_id ?? null, handle, name: profile.name };
}

async function rememberChannel(admin: SupabaseClient, m: InboundMetaMessage, who: Identity) {
  if (!who.contactId) return;
  const { error } = await admin.from("contact_channels").upsert(
    {
      contact_id: who.contactId,
      channel: m.channel,
      external_id: m.senderId,
      handle: who.handle,
      display_name: who.name,
      last_inbound_at: m.sentAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "channel,external_id" }
  );
  if (error) console.error("[meta inbound] contact channel upsert failed:", error.code, error.message);
}

function bodyText(m: InboundMetaMessage): string {
  const lines = [m.text.trim()];
  for (const a of m.attachments) lines.push(a.url ? `[${a.type}] ${a.url}` : `[${a.type}]`);
  return lines.filter(Boolean).join("\n");
}

export type StoredMetaMessage = { stored: boolean; contactId: number | null; bandRequestId: string | null };

/* Files a Messenger or Instagram message in the correspondence table, under
   the contact and the newest application it can be tied to. A repeat delivery
   of the same message id is dropped by the unique index. */
export async function storeInboundMetaMessage(env: MetaEnv, m: InboundMetaMessage): Promise<StoredMetaMessage> {
  const admin = createAdminClient();
  const who = await identify(admin, env, m);
  await rememberChannel(admin, m, who);

  const { error } = await admin.from("email_messages").insert({
    band_booking_request_id: who.bandRequestId,
    music_act_id: who.musicActId,
    contact_id: who.contactId,
    direction: "inbound",
    kind: "message",
    channel: m.channel,
    external_id: m.messageId,
    sender_name: who.name,
    from_address: channelAddress(m.channel, m.senderId, who.handle),
    to_addresses: [],
    subject: "",
    text_body: bodyText(m),
    created_at: m.sentAt,
  });
  if (error && error.code !== "23505") {
    console.error("[meta inbound] store failed:", error.code, error.message);
    return { stored: false, contactId: who.contactId, bandRequestId: who.bandRequestId };
  }
  return { stored: !error, contactId: who.contactId, bandRequestId: who.bandRequestId };
}
