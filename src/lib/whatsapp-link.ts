/* Only WhatsApp's own invite links are accepted - a group invite
   (chat.whatsapp.com/<code>) or a Channel (whatsapp.com/channel/<id>) - so
   the public "Join" button can never point anywhere else. Returns the
   canonical https URL or null. */
export function normaliseWhatsappLink(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  if (!value) return null;
  const group = /^chat\.whatsapp\.com\/(?:invite\/)?([A-Za-z0-9_-]{8,})\/?(?:[?#].*)?$/i.exec(value);
  if (group) return `https://chat.whatsapp.com/${group[1]}`;
  const channel = /^whatsapp\.com\/channel\/([A-Za-z0-9_-]{8,})\/?(?:[?#].*)?$/i.exec(value);
  if (channel) return `https://whatsapp.com/channel/${channel[1]}`;
  return null;
}

export function whatsappLinkKind(url: string): "group" | "channel" {
  return url.includes("/channel/") ? "channel" : "group";
}
