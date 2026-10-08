import type { SupabaseClient } from "@supabase/supabase-js";
import { CHANNEL_LABELS, replyAllowance, type MetaChannel } from "@/lib/meta/channels";
import { readMetaEnv, sendMetaText, type MetaQuickReply } from "@/lib/meta/messaging";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

export type MetaTarget = { channel: MetaChannel; externalId: string; handle: string | null; lastInboundAt: string | null };

export type MetaMessageLinks = {
  bandRequestId?: string | null;
  musicActId?: string | null;
  privateHireRequestId?: string | null;
  contactId?: number | null;
};

/* One text to a Messenger or Instagram account, inside Meta's reply window,
   logged on the same correspondence thread as the emails. */
export async function sendMetaMessage(
  admin: Db,
  p: {
    target: MetaTarget;
    text: string;
    quickReplies?: MetaQuickReply[];
    kind: string;
    links: MetaMessageLinks;
    sentBy: number | null;
  }
): Promise<{ error: string | null }> {
  const text = p.text.trim();
  if (!text) return { error: "Write a message first." };
  const env = readMetaEnv();
  if (!env) return { error: "Messenger and Instagram aren't set up on this site." };
  const { channel } = p.target;
  const allowance = replyAllowance(channel, p.target.lastInboundAt);
  if (allowance.mode === "closed") return { error: allowance.reason };

  const sent = await sendMetaText(env, {
    recipientId: p.target.externalId,
    text,
    humanAgent: allowance.mode === "human_agent",
    quickReplies: p.quickReplies,
  });
  if (!sent.ok) return { error: sent.error };

  const { error } = await admin.from("email_messages").insert({
    band_booking_request_id: p.links.bandRequestId ?? null,
    music_act_id: p.links.musicActId ?? null,
    private_hire_request_id: p.links.privateHireRequestId ?? null,
    contact_id: p.links.contactId ?? null,
    direction: "outbound",
    kind: p.kind,
    channel,
    external_id: sent.messageId,
    sender_id: p.target.externalId,
    from_address: `${channel}:page`,
    to_addresses: [p.target.handle ? `@${p.target.handle}` : p.target.externalId],
    subject: "",
    text_body: text,
    sent_by: p.sentBy,
  });
  if (error) console.error(`[${CHANNEL_LABELS[channel]} send] log failed:`, error.code, error.message);
  return { error: null };
}

export async function venueName(db: Db): Promise<string> {
  const { data } = await db.from("company_information").select("name").maybeSingle();
  return (data?.name as string | null)?.trim() || "Don Fenticas";
}
