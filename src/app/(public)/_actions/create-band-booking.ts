"use server";

import { createClient } from "@/lib/supabase/server";
import { upsertContactByEmail, upsertMusicActFromBand } from "@/lib/music-acts";
import { getAvailableBandDates } from "@/lib/band-availability-data";
import { Resend } from "resend";
import { ADMIN_EMAIL, EMAIL_FROM } from "@/lib/email";
import { renderTemplate } from "@/lib/email/resolve";
import { plainLayout } from "@/lib/email/layout";
import { escapeHtml } from "@/lib/email/escape";
import { resolveSpotifyArtistLink } from "@/lib/spotify-artists";
import { sendCorrespondenceEmail, resendTemplateAttachments } from "@/lib/email/correspondence-data";
import { isValidPhone, PHONE_ERROR } from "@/lib/phone";
import { parseMoney } from "@/lib/money-input";
import { NOTES_MAX_LENGTH } from "@/lib/notes-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { claimContactChannel } from "@/lib/meta/inbound";
import { instagramHandle, type MessageChannel } from "@/lib/meta/channels";
import { isReplyChannel, parseArrival, type ArrivalChannel } from "@/lib/meta/preferred-channel";

const resend = new Resend(process.env.RESEND_API_KEY);

type ServerClient = Awaited<ReturnType<typeof createClient>>;

const appUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL
  : process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";


export interface BandBookingData {
  group_name: string;
  type: string;
  genre?: string;
  payment_amount?: number;
  booker_name: string;
  email: string;
  phone_no?: string;
  social_links: {
    instagram?: string;
    facebook?: string;
    youtube?: string;
    tiktok?: string;
  };
  spotify_url?: string;
  video_urls: string[];
  video_descriptions?: string[];
  preferred_dates: string[];
  notes?: string;
  preferred_channel?: MessageChannel;
  source_channel?: ArrivalChannel | null;
  source_channel_id?: string | null;
}

type SourceRow = { id: string; channel: string; contact_id: number | null };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function sourceChannelRow(id: string | null | undefined): Promise<SourceRow | null> {
  if (!id || !UUID_RE.test(id)) return null;
  const { data } = await createAdminClient()
    .from("contact_channels")
    .select("id, channel, contact_id")
    .eq("id", id)
    .maybeSingle();
  return (data as SourceRow | null) ?? null;
}

export async function createBandBooking(input: BandBookingData) {
  const paymentAmount = parseMoney(input.payment_amount);
  if (input.payment_amount != null && paymentAmount == null) {
    throw new Error("Please enter your fee as an amount of £0 or more.");
  }
  const notes = input.notes?.trim() ?? "";
  if (notes.length > NOTES_MAX_LENGTH) {
    throw new Error(`Please keep your notes under ${NOTES_MAX_LENGTH} characters.`);
  }
  const data: BandBookingData = { ...input, payment_amount: paymentAmount ?? undefined, notes: notes || undefined };

  if (data.phone_no?.trim() && !isValidPhone(data.phone_no)) throw new Error(PHONE_ERROR);

  const preferredChannel: MessageChannel = isReplyChannel(data.preferred_channel) ? data.preferred_channel : "email";
  const sourceRow = await sourceChannelRow(data.source_channel_id);
  const sourceChannel = parseArrival(data.source_channel) ?? (sourceRow ? parseArrival(sourceRow.channel) : null);
  if (preferredChannel === "instagram" && !instagramHandle(data.social_links.instagram)) {
    throw new Error("Add your Instagram handle to be contacted on Instagram, or pick another option.");
  }
  if (preferredChannel === "messenger" && sourceRow?.channel !== "messenger") {
    throw new Error("Messenger is only available when you opened this form from your Messenger chat with us.");
  }
  const videoUrls = data.video_urls.map((u) => u.trim()).filter(Boolean);
  if (videoUrls.length === 0) {
    throw new Error("Please add at least one performance video.");
  }
  if (videoUrls.some((u) => !/^https?:\/\/[^\s]+$/i.test(u))) {
    throw new Error("One of your video links isn't valid. Please check it and try again.");
  }

  const preferredDates = data.preferred_dates.filter(Boolean);
  if (preferredDates.length > 0) {
    const available = new Set(await getAvailableBandDates());
    const unavailable = preferredDates.filter((d) => !available.has(d));
    if (unavailable.length > 0) {
      throw new Error(
        `${unavailable.join(", ")} ${unavailable.length === 1 ? "is" : "are"} no longer available. Please pick another date.`
      );
    }
  }

  const spotify = data.spotify_url?.trim() ? await resolveSpotifyArtistLink(data.spotify_url) : null;
  const spotifyArtist = spotify && "artist" in spotify ? spotify.artist : null;
  const spotifyUrl = spotifyArtist?.url ?? (data.spotify_url?.trim() || undefined);

  const supabase = await createClient();

  const contactId = await upsertContactByEmail(supabase, {
    booker_name: data.booker_name,
    email: data.email,
    phone_no: data.phone_no,
  });
  const musicActId = await upsertMusicActFromBand(supabase, {
    contactId,
    group_name: data.group_name,
    type: data.type,
    genre: data.genre,
    spotify_url: spotifyUrl,
    social_links: data.social_links,
    video_urls: data.video_urls,
    video_descriptions: data.video_descriptions,
  });

  const { data: record, error } = await supabase
    .from("band_booking_requests")
    .insert([
      {
        group_name: data.group_name,
        type: data.type,
        genre: data.genre || null,
        payment_amount: data.payment_amount ?? null,
        booker_name: data.booker_name,
        email: data.email,
        contact_id: contactId,
        phone_no: data.phone_no || null,
        social_links: data.social_links,
        spotify_url: spotifyUrl ?? null,
        spotify_image_url: spotifyArtist?.imageUrl ?? null,
        spotify_followers: spotifyArtist?.followers ?? null,
        video_urls: videoUrls,
        video_descriptions: data.video_descriptions ?? [],
        preferred_dates: preferredDates,
        notes: data.notes || null,
        status: "new",
        payment_status: "no_payment",
        music_acts_id: musicActId,
        preferred_channel: preferredChannel,
        source_channel: sourceChannel,
        source_channel_id: sourceRow?.id ?? null,
      },
    ])
    .select("id")
    .single();

  if (error || !record) {
    console.error("Band booking insert error:", error?.code, error?.message, error?.details);
    throw new Error("Failed to submit your application. Please try again.");
  }

  await Promise.allSettled([
    sourceRow && contactId
      ? claimContactChannel(createAdminClient(), sourceRow.id, {
          contactId,
          bandRequestId: record.id,
          musicActId,
          instagramHandle: instagramHandle(data.social_links.instagram),
        })
      : Promise.resolve(),
    sendBookerEmail(supabase, record.id, data.booker_name, data.email),
    sendAdminEmail(supabase, data, record.id),
  ]);

  return { success: true, id: record.id };
}

async function sendBookerEmail(supabase: ServerClient, requestId: string, name: string, email: string) {
  const slots = await renderTemplate(supabase, "band.application.customer", {
    customerName: name,
  });
  if (!slots) return;

  await sendCorrespondenceEmail({
    resend,
    links: { bandRequestId: requestId },
    to: email,
    subject: slots.subject,
    templateSlots: slots,
    html: plainLayout({ slots }),
    kind: "application",
  });
}

async function sendAdminEmail(supabase: ServerClient, data: BandBookingData, id: string) {
  const slots = await renderTemplate(supabase, "band.application.admin", {
    bookerName: data.booker_name,
  });
  if (!slots) return;

  /* Two variable-length lists and several optional fields, all of it typed into
     a public form - generated and escaped rather than authored. */
  const socials = Object.entries(data.social_links)
    .filter(([, v]) => v)
    .map(([k, v]) => `<li><strong>${escapeHtml(k)}:</strong> ${escapeHtml(String(v))}</li>`)
    .join("");

  const videos = data.video_urls
    .filter(Boolean)
    .map((u, i) => {
      const desc = data.video_descriptions?.[i]?.trim();
      return `<li>${escapeHtml(u)}${desc ? ` - ${escapeHtml(desc)}` : ""}</li>`;
    })
    .join("");

  const dates = data.preferred_dates.filter(Boolean).join(", ") || "Not specified";
  const requestUrl = `${appUrl}/event-bookings/music-bookings?open=${id}`;

  const panelHtml = [
    `<p><strong>Act / Group Name:</strong> ${escapeHtml(data.group_name)}</p>`,
    `<p><strong>Type:</strong> ${escapeHtml(data.type)}</p>`,
    data.genre ? `<p><strong>Genre:</strong> ${escapeHtml(data.genre)}</p>` : "",
    data.payment_amount != null
      ? `<p><strong>Expected Payment:</strong> £${escapeHtml(data.payment_amount.toFixed(2))}</p>`
      : "",
    `<p><strong>Booker Name:</strong> ${escapeHtml(data.booker_name)}</p>`,
    `<p><strong>Email:</strong> ${escapeHtml(data.email)}</p>`,
    `<p><strong>Phone:</strong> ${escapeHtml(data.phone_no || "-")}</p>`,
    `<p><strong>Preferred Dates:</strong> ${escapeHtml(dates)}</p>`,
    socials ? `<p><strong>Social Links:</strong></p><ul>${socials}</ul>` : "",
    videos ? `<p><strong>Video Links:</strong></p><ul>${videos}</ul>` : "",
    data.notes ? `<p><strong>Notes:</strong> ${escapeHtml(data.notes)}</p>` : "",
  ].join("");

  await resend.emails.send({
    from: EMAIL_FROM,
    to: ADMIN_EMAIL,
    subject: slots.subject,
    html: plainLayout({
      slots,
      panelHtml,
      ctaUrl: requestUrl,
      trailer: `Application ID: ${escapeHtml(id)}`,
    }),
    ...(await resendTemplateAttachments(slots)),
  });
}
