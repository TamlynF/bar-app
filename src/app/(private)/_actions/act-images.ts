"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentEmployeeId } from "@/lib/current-employee";
import { revalidatePublicEventPages } from "@/lib/revalidate-public";
import {
  ACT_IMAGES_BUCKET,
  isImageContentType,
  shouldAskActCoverUpdate,
  type ActImage,
  type BookingForCoverCheck,
} from "@/lib/act-images";
import {
  insertActImage,
  loadActImages,
  setActCover,
  setRequestCover,
  setRequestCovers,
  storeActImageBytes,
} from "@/lib/act-images-server";
import { EMAIL_ATTACHMENTS_BUCKET } from "@/lib/email/correspondence-data";

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function revalidateActPages() {
  revalidatePath("/event-bookings/music-bookings");
  revalidatePath("/settings/music-acts");
  revalidatePath("/event-setups/events");
  revalidatePublicEventPages();
}

function isOwnBucketUrl(url: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return !!base && url.startsWith(`${base}/storage/v1/object/public/${ACT_IMAGES_BUCKET}/`);
}

export async function listActImagesAction(actId: string): Promise<ActImage[]> {
  const supabase = await createClient();
  return loadActImages(supabase, actId);
}

/* Records a picture the browser has already put in the act-images bucket. */
export async function addActImageAction(input: {
  actId: string;
  requestId?: string | null;
  url: string;
  path: string;
}): Promise<Result<ActImage>> {
  if (!isOwnBucketUrl(input.url)) return { ok: false, error: "That image isn't in our storage." };
  const supabase = await createClient();
  const employeeId = await getCurrentEmployeeId(supabase);
  const image = await insertActImage(supabase, {
    actId: input.actId,
    requestId: input.requestId ?? null,
    url: input.url,
    storagePath: input.path,
    source: "upload",
    createdBy: employeeId,
  });
  if (!image) return { ok: false, error: "Couldn't save the photo." };
  revalidateActPages();
  return { ok: true, value: image };
}

export type ActCoverState = { actCoverId: string | null; actName: string };

export async function actCoverStateAction(actId: string): Promise<ActCoverState | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("music_acts").select("cover_image_id, group_name").eq("id", actId).maybeSingle();
  return data ? { actCoverId: (data.cover_image_id as string | null) ?? null, actName: data.group_name as string } : null;
}

/* The booking's poster, and the act's too when asked (or when the act had
   none - that one is filled in without a question). */
export async function setRequestCoverAction(input: {
  requestId: string;
  actId: string | null;
  coverId: string | null;
  updateAct: boolean;
}): Promise<Result<{ actUpdated: boolean }>> {
  const supabase = await createClient();
  const employeeId = await getCurrentEmployeeId(supabase);
  const error = await setRequestCover(supabase, input.requestId, input.coverId, employeeId);
  if (error) return { ok: false, error };

  let actUpdated = false;
  if (input.actId && input.coverId) {
    const { data: act } = await supabase.from("music_acts").select("cover_image_id").eq("id", input.actId).maybeSingle();
    const actCoverId = (act?.cover_image_id as string | null) ?? null;
    const needsAsk = shouldAskActCoverUpdate(actCoverId, input.coverId);
    if ((!actCoverId || (needsAsk && input.updateAct)) && actCoverId !== input.coverId) {
      const actError = await setActCover(supabase, input.actId, input.coverId, employeeId);
      if (actError) return { ok: false, error: actError };
      actUpdated = true;
    }
  }
  revalidateActPages();
  return { ok: true, value: { actUpdated } };
}

export async function bookingsForActAction(actId: string): Promise<BookingForCoverCheck[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("band_booking_requests")
    .select("id, group_name, status, selected_date, cover_image_id")
    .eq("music_acts_id", actId)
    .order("selected_date", { ascending: true, nullsFirst: false });
  return ((data ?? []) as (BookingForCoverCheck & { group_name: string | null })[]).map((b) => ({
    ...b,
    group_name: b.group_name ?? "",
  }));
}

/* The act's poster, and any bookings the caller chose to bring along. */
export async function setActCoverAction(input: {
  actId: string;
  coverId: string | null;
  bookingIds: string[];
}): Promise<Result<null>> {
  const supabase = await createClient();
  const employeeId = await getCurrentEmployeeId(supabase);
  const error =
    (await setActCover(supabase, input.actId, input.coverId, employeeId)) ??
    (await setRequestCovers(supabase, input.bookingIds, input.coverId, employeeId));
  if (error) return { ok: false, error };
  revalidateActPages();
  return { ok: true, value: null };
}

/* Copies a picture out of a message (private attachments bucket) into the
   public act-images bucket and files it under the act, optionally as the
   poster of the booking the message belongs to. */
export async function attachmentToActImageAction(input: {
  messageId: string;
  path: string;
  actId: string | null;
  requestId: string | null;
  setAsPoster: boolean;
}): Promise<Result<{ image: ActImage; actUpdated: boolean }>> {
  const supabase = await createClient();
  const employeeId = await getCurrentEmployeeId(supabase);
  if (!employeeId) return { ok: false, error: "You need to be signed in." };

  const { data: message } = await supabase
    .from("email_messages")
    .select("id, attachments, band_booking_request_id, music_act_id")
    .eq("id", input.messageId)
    .maybeSingle();
  if (!message) return { ok: false, error: "That message is no longer here." };
  const attachment = ((message.attachments ?? []) as { path: string; contentType: string }[]).find((a) => a.path === input.path);
  if (!attachment || !isImageContentType(attachment.contentType)) return { ok: false, error: "That attachment isn't an image." };

  let actId = input.actId ?? (message.music_act_id as string | null);
  const requestId = input.requestId ?? (message.band_booking_request_id as string | null);
  if (!actId && requestId) {
    const { data: req } = await supabase.from("band_booking_requests").select("music_acts_id").eq("id", requestId).maybeSingle();
    actId = (req?.music_acts_id as string | null) ?? null;
  }
  if (!actId) return { ok: false, error: "This conversation isn't linked to an act yet." };

  const admin = createAdminClient();
  const { data: file, error: downloadError } = await admin.storage.from(EMAIL_ATTACHMENTS_BUCKET).download(input.path);
  if (downloadError || !file) return { ok: false, error: "Couldn't read the attachment." };
  const stored = await storeActImageBytes(actId, await file.arrayBuffer(), attachment.contentType, "correspondence");
  if (!stored) return { ok: false, error: "Couldn't copy the picture." };

  const image = await insertActImage(supabase, {
    actId,
    requestId,
    url: stored.url,
    storagePath: stored.path,
    source: "correspondence",
    emailMessageId: input.messageId,
    createdBy: employeeId,
  });
  if (!image) return { ok: false, error: "Couldn't save the photo." };

  let actUpdated = false;
  if (input.setAsPoster) {
    if (requestId) {
      const result = await setRequestCoverAction({ requestId, actId, coverId: image.id, updateAct: false });
      if (!result.ok) return result;
      actUpdated = result.value.actUpdated;
    } else {
      const error = await setActCover(supabase, actId, image.id, employeeId);
      if (error) return { ok: false, error };
      actUpdated = true;
    }
  }
  revalidateActPages();
  return { ok: true, value: { image, actUpdated } };
}
