"use server";

import { createClient } from "@/lib/supabase/server";
import { upsertContactByEmail, upsertMusicActFromBand } from "@/lib/music-acts";
import { getAvailableBandDates } from "@/lib/band-availability-data";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const appUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL
  : process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

const ADMIN_EMAIL = "admin@bookingsdonfenticas.co.uk";
const FROM = "Don Fenticas <admin@bookingsdonfenticas.co.uk>";

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
    sendBookerEmail(data.booker_name, data.email),
    sendAdminEmail(data, record.id),
  ]);

  return { success: true, id: record.id };
}

async function sendBookerEmail(name: string, email: string) {
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1f2937;">
      <div style="background:#fff;padding:40px;border-radius:8px;border:1px solid #e5e7eb;">
        <h2 style="margin-top:0;color:#111827;">Hey ${name}!</h2>
        <p>Thanks for applying to perform at <strong>Don Fenticas</strong>. We've received your application and our team will review it shortly.</p>
        <p>We'll be in touch via email once we've had a chance to review your details.</p>
        <div style="background:#f3f4f6;padding:20px;border-radius:8px;margin:20px 0;">
          <p style="margin:0;font-size:14px;color:#6b7280;">🎸 Don Fenticas - Live Music Venue</p>
        </div>
        <p style="font-size:12px;color:#6b7280;">If you have any questions, reply to this email.</p>
      </div>
    </div>`;

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Band Application Received - Don Fenticas",
    html,
  });
}

async function sendAdminEmail(data: BandBookingData, id: string) {
  const socials = Object.entries(data.social_links)
    .filter(([, v]) => v)
    .map(([k, v]) => `<li><strong>${k}:</strong> ${v}</li>`)
    .join("");

  const videos = data.video_urls
    .filter(Boolean)
    .map((u, i) => {
      const desc = data.video_descriptions?.[i]?.trim();
      return `<li>${u}${desc ? ` - ${desc}` : ""}</li>`;
    })
    .join("");
  const dates = data.preferred_dates.filter(Boolean).join(", ") || "Not specified";
  const requestUrl = `${appUrl}/event-bookings/music-bookings?open=${id}`;

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1f2937;">
      <div style="background:#fff;padding:40px;border-radius:8px;border:1px solid #e5e7eb;">
        <h2 style="margin-top:0;color:#111827;">New Band Application</h2>
        <p>A new band/artist has applied to perform at Don Fenticas.</p>
        <div style="background:#f3f4f6;padding:20px;border-radius:8px;margin:20px 0;">
          <p><strong>Act / Group Name:</strong> ${data.group_name}</p>
          <p><strong>Type:</strong> ${data.type}</p>
          ${data.genre ? `<p><strong>Genre:</strong> ${data.genre}</p>` : ""}
          ${data.payment_amount != null ? `<p><strong>Expected Payment:</strong> £${data.payment_amount}</p>` : ""}
          <p><strong>Booker Name:</strong> ${data.booker_name}</p>
          <p><strong>Email:</strong> ${data.email}</p>
          <p><strong>Phone:</strong> ${data.phone_no || "-"}</p>
          <p><strong>Preferred Dates:</strong> ${dates}</p>
          ${socials ? `<p><strong>Social Links:</strong></p><ul>${socials}</ul>` : ""}
          ${videos ? `<p><strong>Video Links:</strong></p><ul>${videos}</ul>` : ""}
          ${data.notes ? `<p><strong>Notes:</strong> ${data.notes}</p>` : ""}
        </div>
        <div style="text-align:center;margin:32px 0 20px 0;">
          <a href="${requestUrl}" style="background-color:#FDCC4B;color:#26300D;padding:16px 32px;text-decoration:none;border-radius:12px;font-weight:900;display:inline-block;text-transform:uppercase;letter-spacing:1.5px;">View Request</a>
        </div>
        <p style="font-size:12px;color:#6b7280;text-align:center;">
          Button not working? Copy and paste this link:<br>
          <a href="${requestUrl}" style="color:#26300D;text-decoration:underline;margin-top:8px;display:inline-block;">${requestUrl}</a>
        </p>
        <p style="font-size:12px;color:#6b7280;">Application ID: ${id}</p>
      </div>
    </div>`;

  await resend.emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `New Band Application - ${data.booker_name}`,
    html,
  });
}
