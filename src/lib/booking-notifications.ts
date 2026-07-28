import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminBookingsHref, manageBookingPath } from "@/lib/booking-links";
import { isEventBehavior, type EventBehavior } from "@/lib/event-behavior";
import { isBookingGrouping, type BookingGrouping } from "@/lib/booking-grouping";
import { normalizeBookingConfig, type BookingConfig } from "@/lib/booking-config";
import {
  ADMIN_EMAIL,
  EMAIL_FROM,
  buildAdminBookingCancelledEmail,
  buildAdminBookingChangedEmail,
  buildAdminNewBookingEmail,
  buildBookingCancelledEmail,
  buildBookingChangedEmail,
  describeBookingChanges,
  type BookingEmail,
  type BookingSnapshot,
} from "@/lib/booking-emails";

const appUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL
  : process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export interface LoadedBooking {
  snapshot: BookingSnapshot;
  behavior: EventBehavior | null;
  eventId: number | null;
  eventType: string | null;
  eventSubtype: string | null;
  bookingGrouping: BookingGrouping | null;
}

function unwrap<T>(rel: T | T[] | null | undefined): T | null {
  if (Array.isArray(rel)) return rel[0] ?? null;
  return rel ?? null;
}

export async function loadBookingSnapshot(
  bookingId: number | string
): Promise<LoadedBooking | null> {
  const { data, error } = await createAdminClient()
    .from("bookings")
    .select(`
      id, event_id, group_name, group_size, status, special_requests, total_amount, paid_amount,
      contacts!bookings_contact_id_fkey(full_name, email),
      events!bookings_event_id_fkey(
        id, title, date, booking_config,
        event_types(name, booking_grouping),
        event_subtypes(name, behavior)
      )
    `)
    .eq("id", bookingId)
    .maybeSingle();

  if (error) {
    console.error(`[booking-notifications] could not load booking ${bookingId}:`, error);
    return null;
  }
  if (!data) {
    console.warn(`[booking-notifications] booking ${bookingId} not found — no email sent`);
    return null;
  }

  type ContactRel = { full_name: string | null; email: string | null };
  type TypeRel = { name: string | null; booking_grouping: string | null };
  type SubtypeRel = { name: string | null; behavior: string | null };
  type EventRel = {
    id: number;
    title: string | null;
    date: string | null;
    booking_config: BookingConfig | null;
    event_types: TypeRel | TypeRel[] | null;
    event_subtypes: SubtypeRel | SubtypeRel[] | null;
  };

  const contact = unwrap(data.contacts as unknown as ContactRel | ContactRel[] | null);
  const event = unwrap(data.events as unknown as EventRel | EventRel[] | null);

  if (!contact?.email) {
    console.warn(`[booking-notifications] booking ${bookingId} has no contact email — no email sent`);
    return null;
  }

  const eventType = unwrap(event?.event_types);
  const eventSubtype = unwrap(event?.event_subtypes);
  const behavior = isEventBehavior(eventSubtype?.behavior) ? eventSubtype.behavior : null;
  const rawGrouping = eventType?.booking_grouping;
  const bookingGrouping = isBookingGrouping(rawGrouping) ? rawGrouping : null;
  const groupNameField = normalizeBookingConfig(event?.booking_config).fields.group_name;

  return {
    behavior,
    eventId: (data.event_id as number | null) ?? null,
    eventType: eventType?.name ?? null,
    eventSubtype: eventSubtype?.name ?? null,
    bookingGrouping,
    snapshot: {
      bookingId: data.id as number,
      customerName: contact.full_name || "there",
      customerEmail: contact.email,
      eventTitle: event?.title || "Your Booking",
      eventDate: (event?.date as string | null) ?? null,
      groupName: (data.group_name as string | null) ?? null,
      groupNameLabel: groupNameField.label,
      groupSize: (data.group_size as number | null) ?? null,
      status: (data.status as string | null) ?? null,
      specialRequests: (data.special_requests as string | null) ?? null,
      totalAmount: (data.total_amount as number | null) ?? null,
      paidAmount: (data.paid_amount as number | null) ?? null,
    },
  };
}

async function send(to: string, email: BookingEmail): Promise<void> {
  try {
    const { error } = await getResend().emails.send({
      from: EMAIL_FROM,
      to,
      subject: email.subject,
      html: email.html,
    });
    if (error) console.error("Resend API Error:", error);
  } catch (err) {
    console.error("Email failed (non-blocking):", err);
  }
}

function urls(loaded: LoadedBooking) {
  console.log("LoadedBooking: ", JSON.stringify(loaded, null, 2));
  return {
    manageUrl: `${appUrl}${manageBookingPath(loaded.snapshot.bookingId)}`,
    adminUrl: `${appUrl}${adminBookingsHref({
      behavior: loaded.behavior ?? "standard",
      bookingGrouping: loaded.bookingGrouping,
      eventType: loaded.eventType,
      eventSubtype: loaded.eventSubtype,
      eventId: loaded.eventId,
      bookingId: loaded.snapshot.bookingId,
    })}`,
  };
}

export async function notifyAdminBookingCreated(
  bookingId: number | string
): Promise<void> {
  console.log("notifyAdminBookingCreated", bookingId);
  const loaded = await loadBookingSnapshot(bookingId);
  console.log("Loaded booking snapshot: ", JSON.stringify(loaded, null, 2));
  if (!loaded) return;

  await send(ADMIN_EMAIL, buildAdminNewBookingEmail({ booking: loaded.snapshot, adminUrl: urls(loaded).adminUrl }));
}

export async function notifyBookingChanged(
  bookingId: number | string,
  before: BookingSnapshot,
  opts: { changedByAdmin?: boolean } = {}
): Promise<void> {
  const loaded = await loadBookingSnapshot(bookingId);
  if (!loaded) return;

  const changes = describeBookingChanges(before, loaded.snapshot);
  if (changes.length === 0) return;

  const { manageUrl, adminUrl } = urls(loaded);

  await send(
    loaded.snapshot.customerEmail,
    buildBookingChangedEmail({
      booking: loaded.snapshot,
      changes,
      manageUrl,
      changedByAdmin: opts.changedByAdmin,
    })
  );

  if (!opts.changedByAdmin) {
    await send(
      ADMIN_EMAIL,
      buildAdminBookingChangedEmail({ booking: loaded.snapshot, changes, adminUrl })
    );
  }
}

export async function notifyBookingCancelled(
  bookingId: number | string,
  opts: { cancelledByAdmin?: boolean } = {}
): Promise<void> {
  const loaded = await loadBookingSnapshot(bookingId);
  if (!loaded) return;

  const { adminUrl } = urls(loaded);

  await send(
    loaded.snapshot.customerEmail,
    buildBookingCancelledEmail({ booking: loaded.snapshot, cancelledByAdmin: opts.cancelledByAdmin })
  );

  if (!opts.cancelledByAdmin) {
    await send(ADMIN_EMAIL, buildAdminBookingCancelledEmail({ booking: loaded.snapshot, adminUrl }));
  }
}
