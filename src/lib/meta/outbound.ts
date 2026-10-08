import type { SupabaseClient } from "@supabase/supabase-js";
import { CHANNEL_LABELS, replyAllowance, type MetaChannel } from "@/lib/meta/channels";
import { readMetaEnv, sendMetaCard, sendMetaText, type MetaCard, type MetaQuickReply } from "@/lib/meta/messaging";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

export type MetaTarget = { channel: MetaChannel; externalId: string; handle: string | null; lastInboundAt: string | null };

export type MetaMessageLinks = {
  bandRequestId?: string | null;
  musicActId?: string | null;
  privateHireRequestId?: string | null;
  contactId?: number | null;
};

/* How a card reads in the correspondence thread, where only text is kept. */
export function cardAsText(card: MetaCard): string {
  return [card.title, card.subtitle, ...card.buttons.map((b) => `[${b.title}] ${b.url}`)].filter(Boolean).join("\n");
}

/* One message to a Messenger or Instagram account, inside Meta's reply
   window, logged on the same correspondence thread as the emails. With a
   card the text goes first, then the card, then any closing text; the quick
   replies hang off the last text message, because Instagram only draws them
   under text. */
export async function sendMetaMessage(
  admin: Db,
  p: {
    target: MetaTarget;
    text: string;
    card?: MetaCard;
    afterCard?: string;
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
  const humanAgent = allowance.mode === "human_agent";

  const afterCard = p.card ? (p.afterCard?.trim() ?? "") : "";
  const sent = await sendMetaText(env, {
    recipientId: p.target.externalId,
    text,
    humanAgent,
    quickReplies: p.card ? undefined : p.quickReplies,
  });
  if (!sent.ok) return { error: sent.error };

  let cardError: string | null = null;
  if (p.card) {
    const card = await sendMetaCard(env, {
      recipientId: p.target.externalId,
      card: p.card,
      humanAgent,
      quickReplies: afterCard ? undefined : p.quickReplies,
    });
    if (!card.ok) cardError = card.error;
    else if (afterCard) {
      const closing = await sendMetaText(env, {
        recipientId: p.target.externalId,
        text: afterCard,
        humanAgent,
        quickReplies: p.quickReplies,
      });
      if (!closing.ok) cardError = closing.error;
    }
  }

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
    text_body: p.card && !cardError ? [text, cardAsText(p.card), afterCard].filter(Boolean).join("\n\n") : text,
    sent_by: p.sentBy,
  });
  if (error) console.error(`[${CHANNEL_LABELS[channel]} send] log failed:`, error.code, error.message);
  return { error: cardError ? `The message went out, but the offer card didn't: ${cardError}` : null };
}

export async function venueName(db: Db): Promise<string> {
  const { data } = await db.from("company_information").select("name").maybeSingle();
  return (data?.name as string | null)?.trim() || "Don Fenticas";
}
