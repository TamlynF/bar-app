"use server";

import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployeeId } from "@/lib/current-employee";
import { EMAIL_REPLY_DOMAIN } from "@/lib/email";
import { bareAddress, plainReplyHtml, replySubject, type CorrespondenceMessage } from "@/lib/email/correspondence";
import {
  latestInbound,
  latestSubject,
  loadCorrespondence,
  sendCorrespondenceEmail,
} from "@/lib/email/correspondence-data";

export type CorrespondenceFilter = { bandRequestId: string } | { musicActId: string };

export type CorrespondenceThread = {
  messages: CorrespondenceMessage[];
  recipient: string | null;
  repliesEnabled: boolean;
};

const resend = new Resend(process.env.RESEND_API_KEY);

function revalidateCorrespondence() {
  revalidatePath("/event-bookings/music-bookings");
  revalidatePath("/settings/music-acts");
}

async function recipientFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filter: CorrespondenceFilter
): Promise<string | null> {
  const inbound = await latestInbound(supabase, filter);
  if (inbound?.fromAddress) return bareAddress(inbound.fromAddress);

  if ("bandRequestId" in filter) {
    const { data } = await supabase
      .from("band_booking_requests")
      .select("email")
      .eq("id", filter.bandRequestId)
      .maybeSingle();
    return (data?.email as string | null)?.trim() || null;
  }
  const { data } = await supabase
    .from("music_acts")
    .select("contact:contacts(email)")
    .eq("id", filter.musicActId)
    .maybeSingle();
  const contact = Array.isArray(data?.contact) ? data.contact[0] : data?.contact;
  return (contact?.email as string | null | undefined)?.trim() || null;
}

export async function getCorrespondence(filter: CorrespondenceFilter): Promise<CorrespondenceThread> {
  const supabase = await createClient();
  const [messages, recipient] = await Promise.all([
    loadCorrespondence(supabase, filter),
    recipientFor(supabase, filter),
  ]);
  return { messages, recipient, repliesEnabled: !!EMAIL_REPLY_DOMAIN };
}

export async function markCorrespondenceRead(filter: CorrespondenceFilter): Promise<void> {
  const supabase = await createClient();
  let query = supabase
    .from("email_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("direction", "inbound")
    .is("read_at", null);
  query =
    "bandRequestId" in filter
      ? query.eq("band_booking_request_id", filter.bandRequestId)
      : query.eq("music_act_id", filter.musicActId);
  const { error } = await query;
  if (error) {
    console.error("[correspondence] mark read failed:", error.code, error.message);
    return;
  }
  revalidateCorrespondence();
}

export async function sendCorrespondenceReply(
  filter: CorrespondenceFilter,
  body: string
): Promise<{ error: string | null; thread?: CorrespondenceThread }> {
  const text = body.trim();
  if (!text) return { error: "Write a message first." };

  const supabase = await createClient();
  const [recipient, inbound, lastSubject, sentBy] = await Promise.all([
    recipientFor(supabase, filter),
    latestInbound(supabase, filter),
    latestSubject(supabase, filter),
    getCurrentEmployeeId(supabase),
  ]);
  if (!recipient) return { error: "There's no email address for this act." };

  const { error } = await sendCorrespondenceEmail({
    resend,
    links: "bandRequestId" in filter ? { bandRequestId: filter.bandRequestId } : { musicActId: filter.musicActId },
    to: recipient,
    subject: replySubject(inbound?.subject ?? lastSubject ?? ""),
    html: plainReplyHtml(text),
    kind: "message",
    sentBy,
    inReplyTo: inbound?.messageId ?? null,
  });
  if (error) return { error };

  revalidateCorrespondence();
  return { error: null, thread: await getCorrespondence(filter) };
}
