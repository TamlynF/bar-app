import { CHANNEL_LABELS, instagramHandle, type MessageChannel, type MetaChannel } from "@/lib/meta/channels";

/* Where the act opened the booking link from. The reply channels are the
   ones staff can write back on; SMS and WhatsApp are tracked as a source only. */
export type ArrivalChannel = MessageChannel | "sms" | "whatsapp";

export const ARRIVAL_CHANNELS: ArrivalChannel[] = ["email", "instagram", "messenger", "sms", "whatsapp"];

export function parseArrival(value: unknown): ArrivalChannel | null {
  return typeof value === "string" && (ARRIVAL_CHANNELS as string[]).includes(value) ? (value as ArrivalChannel) : null;
}

export type BookingArrival = {
  channel: ArrivalChannel;
  /* Known when the link carried a contact_channels id, e.g. the Instagram handle. */
  handle: string | null;
  channelId: string | null;
};

export type PreferredOption = {
  channel: MessageChannel;
  label: string;
  /* What a reply on this channel goes to - the address, the handle, the chat. */
  detail: string | null;
  available: boolean;
  why?: string;
};

export function preferredChannelOptions(p: {
  email: string;
  instagram: string | null | undefined;
  arrival: BookingArrival | null;
}): PreferredOption[] {
  const email = p.email.trim();
  const handle = instagramHandle(p.instagram);
  const options: PreferredOption[] = [
    {
      channel: "email",
      label: CHANNEL_LABELS.email,
      detail: email || null,
      available: !!email,
      why: email ? undefined : "Enter your email address above to pick this.",
    },
    {
      channel: "instagram",
      label: CHANNEL_LABELS.instagram,
      detail: handle ? `@${handle}` : null,
      available: !!handle,
      why: handle ? undefined : "Add your Instagram handle in Social Links to pick this.",
    },
  ];
  if (p.arrival?.channel === "messenger") {
    options.push({
      channel: "messenger",
      label: "Facebook Messenger",
      detail: "your Messenger chat with us",
      available: true,
    });
  }
  return options;
}

/* The channel the link came in on, when it is one we can reply on and the
   act has given what it needs; otherwise email. */
export function defaultPreferredChannel(options: PreferredOption[], arrival: BookingArrival | null): MessageChannel {
  const wanted = options.find((o) => o.channel === arrival?.channel);
  if (wanted?.available) return wanted.channel;
  return "email";
}

export function isReplyChannel(value: unknown): value is MessageChannel {
  return value === "email" || value === "instagram" || value === "messenger";
}

/* The booking link staff send from a chat: the form reads the channel and
   the contact_channels row, so the handle is filled in and the preferred
   channel defaults to where they are already talking. */
export function bookingLinkFor(siteUrl: string, channel: MetaChannel, channelRowId: string): string {
  const base = siteUrl.replace(/\/$/, "");
  return `${base}/book/band?via=${channel}&c=${encodeURIComponent(channelRowId)}`;
}

export function describePreferredChannel(
  channel: MessageChannel,
  p: { email?: string | null; instagram?: string | null }
): string {
  if (channel === "instagram") {
    const handle = instagramHandle(p.instagram);
    return handle ? `Instagram (@${handle})` : "Instagram";
  }
  if (channel === "messenger") return "Facebook Messenger";
  return p.email?.trim() ? `Email (${p.email.trim()})` : "Email";
}
