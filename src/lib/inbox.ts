import type { SupabaseClient } from "@supabase/supabase-js";
import type { ThreadOwner } from "@/components/admin/correspondence-panel";
import { isMetaChannel, type MessageChannel } from "@/lib/meta/channels";
import { PRIVATE_HIRE_STATUS_LABEL, normalizePrivateHireStatus } from "@/lib/private-hire-status";

export type InboxSource = "band" | "hire" | "enquiry" | "act" | "customer" | "chat";

export const INBOX_SOURCE_LABELS: Record<InboxSource, string> = {
  band: "Band application",
  hire: "Private hire",
  enquiry: "Enquiry",
  act: "Music act",
  customer: "Customer",
  chat: "New chat",
};

export type InboxThread = {
  key: string;
  owner: ThreadOwner;
  name: string;
  handle: string | null;
  source: InboxSource;
  status: string | null;
  recordHref: string | null;
  channels: MessageChannel[];
  lastAt: string;
  lastPreview: string;
  lastDirection: "inbound" | "outbound";
  lastChannel: MessageChannel;
  unread: number;
  total: number;
  avatarUrl: string | null;
};

type Row = {
  id: string;
  direction: "inbound" | "outbound";
  channel: MessageChannel | null;
  sender_name: string | null;
  sender_id: string | null;
  from_address: string;
  subject: string;
  text_body: string;
  read_at: string | null;
  created_at: string;
  band_booking_request_id: string | null;
  private_hire_request_id: string | null;
  enquiry_id: string | null;
  music_act_id: string | null;
  contact_id: number | null;
};

const MAX_MESSAGES = 1500;

function preview(r: Row): string {
  const body = r.text_body.replace(/\s+/g, " ").trim();
  const subject = r.subject.trim();
  const text = r.channel === "email" || !r.channel ? subject || body : body || subject;
  return text.length > 140 ? `${text.slice(0, 137).trimEnd()}…` : text;
}

function handleFrom(address: string): string | null {
  const m = address.match(/^(?:instagram|messenger):@(.+)$/);
  return m ? m[1] : null;
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

function ownerOf(r: Row): { key: string; owner: ThreadOwner; source: InboxSource } | null {
  if (r.band_booking_request_id) {
    return { key: `band:${r.band_booking_request_id}`, owner: { bandRequestId: r.band_booking_request_id }, source: "band" };
  }
  if (r.private_hire_request_id) {
    return { key: `hire:${r.private_hire_request_id}`, owner: { privateHireRequestId: r.private_hire_request_id }, source: "hire" };
  }
  if (r.enquiry_id) return { key: `enq:${r.enquiry_id}`, owner: { enquiryId: r.enquiry_id }, source: "enquiry" };
  if (r.music_act_id) return { key: `act:${r.music_act_id}`, owner: { musicActId: r.music_act_id }, source: "act" };
  if (r.contact_id) return { key: `cust:${r.contact_id}`, owner: { contactId: r.contact_id }, source: "customer" };
  if (isMetaChannel(r.channel)) {
    const senderId = r.sender_id ?? r.from_address.match(/^(?:instagram|messenger):(\d+)$/)?.[1] ?? null;
    if (senderId) return { key: `chat:${r.channel}:${senderId}`, owner: { channel: r.channel, senderId }, source: "chat" };
  }
  return null;
}

async function namesFor(
  supabase: SupabaseClient,
  table: string,
  ids: (string | number)[],
  select: string
): Promise<Map<string, Record<string, unknown>>> {
  const out = new Map<string, Record<string, unknown>>();
  if (ids.length === 0) return out;
  const { data } = await supabase.from(table).select(select).in("id", ids);
  for (const row of (data ?? []) as unknown as Record<string, unknown>[]) out.set(String(row.id), row);
  return out;
}

/* The profile picture Meta gave us for a chat sender, shown on the thread
   it was filed under: by contact where the sender is known, else by the
   Meta id for an unclaimed chat. */
async function attachAvatars(supabase: SupabaseClient, rows: Row[], threads: { key: string; owner: ThreadOwner; avatarUrl: string | null }[]): Promise<void> {
  const contactIds = [...new Set(rows.map((r) => r.contact_id).filter((id): id is number => id != null))];
  const senderIds = [...new Set(rows.map((r) => r.sender_id).filter((id): id is string => !!id))];
  if (contactIds.length === 0 && senderIds.length === 0) return;
  const { data } = await supabase
    .from("contact_channels")
    .select("contact_id, channel, external_id, profile_pic_url")
    .not("profile_pic_url", "is", null)
    .or([
      contactIds.length ? `contact_id.in.(${contactIds.join(",")})` : null,
      senderIds.length ? `external_id.in.(${senderIds.map((s) => `"${s}"`).join(",")})` : null,
    ].filter(Boolean).join(","));
  const byContact = new Map<number, string>();
  const bySender = new Map<string, string>();
  for (const c of (data ?? []) as { contact_id: number | null; channel: string; external_id: string; profile_pic_url: string }[]) {
    if (c.contact_id != null && !byContact.has(c.contact_id)) byContact.set(c.contact_id, c.profile_pic_url);
    bySender.set(`${c.channel}:${c.external_id}`, c.profile_pic_url);
  }
  const contactOfThread = new Map<string, number>();
  for (const r of rows) {
    const where = ownerOf(r);
    if (where && r.contact_id != null && !contactOfThread.has(where.key)) contactOfThread.set(where.key, r.contact_id);
  }
  for (const t of threads) {
    const o = t.owner;
    if (o.channel && o.senderId) t.avatarUrl = bySender.get(`${o.channel}:${o.senderId}`) ?? null;
    else {
      const contactId = o.contactId ?? contactOfThread.get(t.key);
      t.avatarUrl = contactId != null ? (byContact.get(contactId) ?? null) : null;
    }
  }
}

/* Every conversation across email, Messenger and Instagram, newest first:
   one row per record the messages hang off, or per chat sender when nothing
   has claimed them yet. */
export async function loadInboxThreads(supabase: SupabaseClient): Promise<InboxThread[]> {
  const { data, error } = await supabase
    .from("email_messages")
    .select(
      "id, direction, channel, sender_name, sender_id, from_address, subject, text_body, read_at, created_at, band_booking_request_id, private_hire_request_id, enquiry_id, music_act_id, contact_id"
    )
    .order("created_at", { ascending: false })
    .limit(MAX_MESSAGES);
  if (error) {
    console.error("[inbox] load failed:", error.code, error.message);
    return [];
  }
  const rows = (data ?? []) as Row[];

  type Draft = InboxThread & { senderNames: string[] };
  const threads = new Map<string, Draft>();
  for (const r of rows) {
    const where = ownerOf(r);
    if (!where) continue;
    const channel: MessageChannel = r.channel ?? "email";
    const existing = threads.get(where.key);
    if (existing) {
      existing.total += 1;
      if (r.direction === "inbound" && !r.read_at) existing.unread += 1;
      if (!existing.channels.includes(channel)) existing.channels.push(channel);
      if (r.direction === "inbound" && r.sender_name) existing.senderNames.push(r.sender_name);
      continue;
    }
    threads.set(where.key, {
      key: where.key,
      owner: where.owner,
      source: where.source,
      name: "",
      handle: r.direction === "inbound" ? handleFrom(r.from_address) : null,
      status: null,
      recordHref: null,
      channels: [channel],
      lastAt: r.created_at,
      lastPreview: preview(r),
      lastDirection: r.direction,
      lastChannel: channel,
      unread: r.direction === "inbound" && !r.read_at ? 1 : 0,
      total: 1,
      avatarUrl: null,
      senderNames: r.direction === "inbound" && r.sender_name ? [r.sender_name] : [],
    });
  }

  const list = [...threads.values()];
  await attachAvatars(supabase, rows, list);
  const idsOf = (source: InboxSource, pick: (o: ThreadOwner) => string | number | undefined) =>
    list.filter((t) => t.source === source).map((t) => pick(t.owner)).filter((v): v is string | number => v != null);

  const [bands, hires, enquiries, acts, contacts] = await Promise.all([
    namesFor(supabase, "band_booking_requests", idsOf("band", (o) => o.bandRequestId), "id, group_name, booker_name, status"),
    namesFor(supabase, "private_hire_requests", idsOf("hire", (o) => o.privateHireRequestId), "id, full_name, status"),
    namesFor(supabase, "enquiries", idsOf("enquiry", (o) => o.enquiryId), "id, full_name, subject, status"),
    namesFor(supabase, "music_acts", idsOf("act", (o) => o.musicActId), "id, name"),
    namesFor(supabase, "contacts", idsOf("customer", (o) => o.contactId), "id, full_name"),
  ]);

  for (const t of list) {
    const o = t.owner;
    if (o.bandRequestId) {
      const b = bands.get(o.bandRequestId);
      t.name = String(b?.group_name || b?.booker_name || "Band application");
      t.status = b?.status ? titleCase(String(b.status)) : null;
      t.recordHref = `/event-bookings/music-bookings?request=${o.bandRequestId}`;
    } else if (o.privateHireRequestId) {
      const h = hires.get(o.privateHireRequestId);
      t.name = String(h?.full_name || "Private hire");
      t.status = h?.status ? PRIVATE_HIRE_STATUS_LABEL[normalizePrivateHireStatus(String(h.status))] : null;
      t.recordHref = `/event-bookings/private-bookings?request=${o.privateHireRequestId}`;
    } else if (o.enquiryId) {
      const e = enquiries.get(o.enquiryId);
      t.name = String(e?.full_name || "Enquiry");
      t.status = e?.status ? titleCase(String(e.status)) : null;
      t.recordHref = "/requests/enquiries";
    } else if (o.musicActId) {
      t.name = String(acts.get(o.musicActId)?.name || "Music act");
      t.recordHref = "/settings/music-acts";
    } else if (o.contactId) {
      t.name = String(contacts.get(String(o.contactId))?.full_name || "Customer");
      t.recordHref = "/settings/customers";
    } else {
      t.name = t.senderNames[0] || (t.handle ? `@${t.handle}` : "Unknown sender");
    }
  }

  return list.map(({ senderNames: _names, ...t }) => t);
}
