"use server";

import { createClient } from "@/lib/supabase/server";
import { upsertContactByEmail, upsertMusicActFromBand } from "@/lib/music-acts";
import { getAvailableBandDates } from "@/lib/band-availability-data";
import { Resend } from "resend";
import { ADMIN_EMAIL, EMAIL_FROM } from "@/lib/email";
import { renderTemplate } from "@/lib/email/resolve";
import { plainLayout } from "@/lib/email/layout";
import { escapeHtml } from "@/lib/email/escape";

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
}

export async function createBandBooking(data: BandBookingData) {
  const videoUrls = data.video_urls.filter(Boolean);
  if (videoUrls.length === 0) {
    throw new Error("Please upload at least one performance video.");
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
    spotify_url: data.spotify_url,
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
        spotify_url: data.spotify_url || null,
        video_urls: videoUrls,
        video_descriptions: data.video_descriptions ?? [],
        preferred_dates: preferredDates,
        notes: data.notes || null,
        status: "new",
        payment_status: "no_payment",
        music_acts_id: musicActId,
      },
    ])
    .select("id")
    .single();

  if (error || !record) {
    console.error("Band booking insert error:", error);
    throw new Error("Failed to submit your application. Please try again.");
  }

  await Promise.allSettled([
    sendBookerEmail(supabase, data.booker_name, data.email),
    sendAdminEmail(supabase, data, record.id),
  ]);

  return { success: true, id: record.id };
}

async function sendBookerEmail(supabase: ServerClient, name: string, email: string) {
  const slots = await renderTemplate(supabase, "band.application.customer", {
    customerName: name,
  });
  if (!slots) return;

  await resend.emails.send({
    from: EMAIL_FROM,
    to: email,
    subject: slots.subject,
    html: plainLayout({ slots }),
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
      ? `<p><strong>Expected Payment:</strong> £${escapeHtml(String(data.payment_amount))}</p>`
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
  });
}
