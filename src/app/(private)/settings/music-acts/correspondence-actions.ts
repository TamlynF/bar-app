"use server";

import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployeeId } from "@/lib/current-employee";
import { EMAIL_REPLY_DOMAIN } from "@/lib/email";
import {
  bareAddress,
  correspondenceBookingLabel,
  correspondenceColumn,
  htmlToPlainText,
  replyHtml,
  replySubject,
  type CorrespondenceFilter,
  type CorrespondenceMessage,
} from "@/lib/email/correspondence";
import {
  escapeLike,
  latestInbound,
  latestSubject,
  loadCorrespondence,
  sendCorrespondenceEmail,
} from "@/lib/email/correspondence-data";

export type { CorrespondenceFilter };

export type CorrespondenceBooking = { id: string; label: string };

/* Whose emails can be moved between which records: an act's emails between
   its band bookings, a private hire's between that customer's hires. */
export type RelinkScope = { musicActId: string } | { privateHireRequestId: string };

export type CorrespondenceThread = {
  messages: CorrespondenceMessage[];
  recipient: string | null;
  repliesEnabled: boolean;
  /* On an act's thread its band bookings, on a private hire's the customer's
     hires - so each email can say which one it belongs to and be moved. */
  bookings?: CorrespondenceBooking[];
  bookingNoun?: string;
};

const resend = new Resend(process.env.RESEND_API_KEY);
const MAX_REPLY_FILES = 5;
const MAX_REPLY_BYTES = 9 * 1024 * 1024;

function revalidateCorrespondence() {
  revalidatePath("/event-bookings/music-bookings");
  revalidatePath("/settings/music-acts");
  revalidatePath("/event-bookings/private-bookings");
  revalidatePath("/requests/enquiries");
  revalidatePath("/settings/customers");
}

async function emailOf(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  id: string | number
): Promise<string | null> {
  const { data } = await supabase.from(table).select("email").eq("id", id).maybeSingle();
  return (data?.email as string | null | undefined)?.trim() || null;
}

async function recipientFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filter: CorrespondenceFilter
): Promise<string | null> {
  const inbound = await latestInbound(supabase, filter);
  if (inbound?.fromAddress) return bareAddress(inbound.fromAddress);

  if ("bandRequestId" in filter) return emailOf(supabase, "band_booking_requests", filter.bandRequestId);
  if ("privateHireRequestId" in filter) return emailOf(supabase, "private_hire_requests", filter.privateHireRequestId);
  if ("enquiryId" in filter) return emailOf(supabase, "enquiries", filter.enquiryId);
  if ("contactId" in filter) return emailOf(supabase, "contacts", filter.contactId);
  const { data } = await supabase
    .from("music_acts")
    .select("contact:contacts(email)")
    .eq("id", filter.musicActId)
    .maybeSingle();
  const contact = Array.isArray(data?.contact) ? data.contact[0] : data?.contact;
  return (contact?.email as string | null | undefined)?.trim() || null;
}

async function actBookings(
  supabase: Awaited<ReturnType<typeof createClient>>,
  musicActId: string
): Promise<CorrespondenceBooking[]> {
  const { data, error } = await supabase
    .from("band_booking_requests")
    .select("id, status, selected_date, created_at, linked_event:events!band_booking_requests_event_id_fkey(date)")
    .eq("music_acts_id", musicActId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[correspondence] act bookings failed:", error.code, error.message);
    return [];
  }
  return (data ?? []).map((r) => {
    const event = Array.isArray(r.linked_event) ? r.linked_event[0] : r.linked_event;
    return {
      id: r.id as string,
      label: correspondenceBookingLabel({
        id: r.id as string,
        status: r.status as string | null,
        date: ((event?.date as string | null | undefined) ?? (r.selected_date as string | null)) || null,
        createdAt: r.created_at as string,
      }),
    };
  });
}

async function customerHires(
  supabase: Awaited<ReturnType<typeof createClient>>,
  privateHireRequestId: string
): Promise<CorrespondenceBooking[]> {
  const { data: hire } = await supabase
    .from("private_hire_requests")
    .select("contact_id, email")
    .eq("id", privateHireRequestId)
    .maybeSingle();
  if (!hire) return [];
  let query = supabase
    .from("private_hire_requests")
    .select("id, status, selected_date, preferred_date, created_at, linked_event:events!private_hire_requests_event_id_fkey(date)")
    .order("created_at", { ascending: false });
  query = hire.contact_id
    ? query.eq("contact_id", hire.contact_id)
    : query.ilike("email", escapeLike(String(hire.email ?? "")));
  const { data, error } = await query;
  if (error) {
    console.error("[correspondence] customer hires failed:", error.code, error.message);
    return [];
  }
  return (data ?? []).map((r) => {
    const event = Array.isArray(r.linked_event) ? r.linked_event[0] : r.linked_event;
    return {
      id: r.id as string,
      label: correspondenceBookingLabel({
        id: r.id as string,
        status: r.status as string | null,
        date:
          ((event?.date as string | null | undefined) ??
            (r.selected_date as string | null) ??
            (r.preferred_date as string | null)) ||
          null,
        createdAt: r.created_at as string,
      }),
    };
  });
}

async function linkOptions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filter: CorrespondenceFilter
): Promise<Pick<CorrespondenceThread, "bookings" | "bookingNoun">> {
  if ("musicActId" in filter) return { bookings: await actBookings(supabase, filter.musicActId), bookingNoun: "Booking" };
  if ("privateHireRequestId" in filter) {
    return { bookings: await customerHires(supabase, filter.privateHireRequestId), bookingNoun: "Private hire" };
  }
  return {};
}

export async function getCorrespondence(filter: CorrespondenceFilter): Promise<CorrespondenceThread> {
  const supabase = await createClient();
  const [messages, recipient, links] = await Promise.all([
    loadCorrespondence(supabase, filter),
    recipientFor(supabase, filter),
    linkOptions(supabase, filter),
  ]);
  return { messages, recipient, repliesEnabled: !!EMAIL_REPLY_DOMAIN, ...links };
}

/* Moves an email onto another of the act's band bookings or the customer's
   private hires, or off them all. That record's own thread - and, for a band
   booking, the invoice request's "already sent" check - follows the link. An
   email moved off a private hire stays on the customer's record. */
export async function relinkCorrespondenceMessage(
  messageId: string,
  scope: RelinkScope,
  targetId: string | null
): Promise<{ error: string | null; thread?: CorrespondenceThread }> {
  const supabase = await createClient();
  const isAct = "musicActId" in scope;
  const filter: CorrespondenceFilter = scope;

  if (targetId) {
    const options = (await linkOptions(supabase, filter)).bookings ?? [];
    if (!options.some((o) => o.id === targetId)) {
      return { error: isAct ? "That booking isn't one of this act's." : "That private hire isn't this customer's." };
    }
  }

  const column = isAct ? "band_booking_request_id" : "private_hire_request_id";
  const { data, error } = await supabase
    .from("email_messages")
    .update({ [column]: targetId })
    .eq("id", messageId)
    .eq(...correspondenceColumn(filter))
    .select("id");
  if (error) {
    console.error("[correspondence] relink failed:", error.code, error.message);
    return { error: "Couldn't move that email." };
  }
  if (!data?.length) return { error: "That email isn't on this thread." };
  revalidateCorrespondence();
  return { error: null, thread: await getCorrespondence(filter) };
}

export async function markCorrespondenceRead(filter: CorrespondenceFilter): Promise<void> {
  const supabase = await createClient();
  let query = supabase
    .from("email_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("direction", "inbound")
    .is("read_at", null);
  query = query.eq(...correspondenceColumn(filter));
  const { error } = await query;
  if (error) {
    console.error("[correspondence] mark read failed:", error.code, error.message);
    return;
  }
  revalidateCorrespondence();
}

export async function sendCorrespondenceReply(
  filter: CorrespondenceFilter,
  form: FormData
): Promise<{ error: string | null; thread?: CorrespondenceThread }> {
  const rawHtml = String(form.get("html") ?? "").trim();
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!htmlToPlainText(rawHtml).trim() && files.length === 0) return { error: "Write a message first." };
  if (files.length > MAX_REPLY_FILES) return { error: `Attach up to ${MAX_REPLY_FILES} files.` };
  if (files.reduce((sum, f) => sum + f.size, 0) > MAX_REPLY_BYTES) {
    return { error: "Attachments must be under 9 MB in total." };
  }

  const supabase = await createClient();
  const [recipient, inbound, lastSubject, sentBy] = await Promise.all([
    recipientFor(supabase, filter),
    latestInbound(supabase, filter),
    latestSubject(supabase, filter),
    getCurrentEmployeeId(supabase),
  ]);
  if (!recipient) return { error: "There's no email address on file." };

  const { error } = await sendCorrespondenceEmail({
    resend,
    links: filter,
    to: recipient,
    subject: replySubject(inbound?.subject ?? lastSubject ?? ""),
    html: replyHtml(rawHtml),
    kind: "message",
    sentBy,
    inReplyTo: inbound?.messageId ?? null,
    attachments: await Promise.all(
      files.map(async (f) => ({
        filename: f.name,
        content: Buffer.from(await f.arrayBuffer()),
        contentType: f.type || "application/octet-stream",
      }))
    ),
  });
  if (error) return { error };

  revalidateCorrespondence();
  return { error: null, thread: await getCorrespondence(filter) };
}
