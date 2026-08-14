"use server";

import { createClient } from "@/lib/supabase/server";
import { squareClient } from "@/lib/square";
import { SquareError } from "square";
import { randomUUID } from "crypto";
import { format } from "date-fns";
import { hasVenueSpaceFor, updateFullyBookedStatus } from "@/lib/update-fully-booked";
import {
  allocateOnCreate,
  commitMapping,
  seatingApplies,
  type FreeTable,
} from "@/lib/table-allocation";
import { Resend } from "resend";
import { revalidatePath } from "next/cache";
import {
  buildBuyerPhone,
  buildCheckoutOptions,
  buildEventOrder,
  buildPrePopulatedData,
} from "@/lib/square-order";
import { getContactEmail } from "@/lib/company-info";
import { EMAIL_FROM } from "@/lib/email";
import {
  buildPaymentPendingEmail,
  paymentPendingMergeValues,
} from "@/lib/payment-pending-email";
import { buildBookingConfirmedEmail, formatEventDate } from "@/lib/booking-emails";
import { renderTemplate } from "@/lib/email/resolve";
import { notifyAdminBookingCreated } from "@/lib/booking-notifications";
import { checkoutReturnPath } from "@/lib/booking-links";
import { resolveOwningBookingConfig } from "@/lib/resolve-booking-config";
import { isBookingGrouping } from "@/lib/booking-grouping";
import { normalizeBookingConfig, type BookingConfig } from "@/lib/booking-config";
import { normalizeGroupName } from "@/lib/group-name";

const appUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL
  : process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

const resend = new Resend(process.env.RESEND_API_KEY);

function missingSquareConfig(): string[] {
  const missing: string[] = [];
  if (!process.env.SQUARE_ACCESS_TOKEN) missing.push("SQUARE_ACCESS_TOKEN");
  if (!process.env.SQUARE_LOCATION_ID) missing.push("SQUARE_LOCATION_ID");
  return missing;
}

function isSquareAuthError(err: unknown): err is SquareError {
  return (
    err instanceof SquareError &&
    (err.statusCode === 401 ||
      err.errors?.some((e) => e.category === "AUTHENTICATION_ERROR"))
  );
}

export async function checkEventGroupName(
  groupName: string,
  eventId: number | string,
  excludeBookingId?: string | number
) {
  const normalized = normalizeGroupName(groupName);
  if (!normalized || !eventId) return { isAvailable: true };

  const supabase = await createClient();

  let query = supabase
    .from("bookings")
    .select("id, group_name")
    .eq("event_id", eventId)
    .eq("status", "confirmed");

  if (excludeBookingId) {
    query = query.neq("id", excludeBookingId);
  }

  const { data: existing } = await query;

  const isTaken = (existing ?? []).some(
    (booking) => normalizeGroupName(booking.group_name) === normalized
  );

  return { isAvailable: !isTaken };
}

export async function createEventBooking(formData: FormData) {
  console.log("createEventBooking called with formData:", Object.fromEntries(formData.entries()));
  console.log("Environment variables:", {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    VERCEL_URL: process.env.VERCEL_URL,
    SQUARE_ENVIRONMENT: process.env.SQUARE_ENVIRONMENT,
    SQUARE_ACCESS_TOKEN_present: !!process.env.SQUARE_ACCESS_TOKEN,
    SQUARE_LOCATION_ID: process.env.SQUARE_LOCATION_ID,
  });
  console.log(formData.get("event_id"), formData.get("full_name"), formData.get("email"), formData.get("group_size"));
  const supabase = await createClient();

  const eventId = parseInt(formData.get("event_id") as string, 10);
  const fullName = formData.get("full_name") as string;
  const email = formData.get("email") as string;
  const countryCode = (formData.get("country_code") as string) || null;
  const phoneNo = (formData.get("phone_no") as string) || null;
  const groupSize = parseInt(formData.get("group_size") as string, 10);
  const specialRequests = (formData.get("special_requests") as string) || null;
  const groupName = (formData.get("group_name") as string) || fullName;

  if (!eventId || !fullName || !email || !groupSize || groupSize < 1) {
    return { error: "Please fill in all required fields." };
  }

  try {
    const { data: event } = await supabase
      .from("events")
      .select(`
        id, date, title, payment_amount, seating_required, is_fully_booked, is_active, is_bookable, booking_config,
        event_types(booking_grouping, booking_config),
        event_subtypes(booking_config, behavior)
      `)
      .eq("id", eventId)
      .single();

    if (!event || !event.is_active || !event.is_bookable) {
      return { error: "This event is not available for booking." };
    }

    if (event.is_fully_booked) {
      return { error: "This event is fully booked." };
    }

    type TypeRel = { booking_grouping: string | null; booking_config: BookingConfig | null };
    type SubtypeRel = { booking_config: BookingConfig | null; behavior: string | null };
    const unwrap = <T,>(rel: T | T[] | null | undefined): T | null =>
      Array.isArray(rel) ? rel[0] ?? null : rel ?? null;

    const eventType = unwrap(event.event_types as unknown as TypeRel | TypeRel[] | null);
    const eventSubtype = unwrap(event.event_subtypes as unknown as SubtypeRel | SubtypeRel[] | null);
    const rawGrouping = eventType?.booking_grouping;

    const bookingConfig = resolveOwningBookingConfig({
      grouping: isBookingGrouping(rawGrouping) ? rawGrouping : null,
      eventConfig: event.booking_config as BookingConfig | null,
      typeConfig: eventType?.booking_config ?? null,
      subtypeConfig: eventSubtype?.booking_config ?? null,
    });

    const groupNameField = normalizeBookingConfig(bookingConfig).fields.group_name;
    if (groupNameField.visible) {
      const { isAvailable } = await checkEventGroupName(groupName, eventId);
      if (!isAvailable) {
        return {
          error: `This ${groupNameField.label.toLowerCase()} is already taken for this event. Please choose another.`,
        };
      }
    }

    if (!seatingApplies(event) && !(await hasVenueSpaceFor(supabase, eventId, groupSize))) {
      return { error: "There isn't enough space left for this booking. Please try a smaller group or another date." };
    }

    const paymentAmountPence = Math.round((event.payment_amount || 0) * 100);
    const isFree = paymentAmountPence === 0;

    if (!isFree) {
      const missing = missingSquareConfig();
      if (missing.length) {
        console.error(
          `[createEventBooking] Square not configured - missing ${missing.join(", ")}. ` +
            `Set them in .env.local and restart the dev server (env vars load at startup).`
        );
        return { error: "Payments are temporarily unavailable. Please try again later." };
      }
    }

    let chosenTable: FreeTable | null = null;
    let status: "confirmed" | "waitlisted" = "confirmed";
    if (isFree && seatingApplies(event)) {
      const allocation = await allocateOnCreate(supabase, { eventId, groupSize });
      status = allocation.status;
      chosenTable = allocation.status === "confirmed" ? allocation.table : null;
    }

    let contactId: number;
    const { data: insertedContact } = await supabase
      .from("contacts")
      .upsert(
        [{ full_name: fullName, email, country_code: countryCode, phone_no: phoneNo }],
        { onConflict: "email", ignoreDuplicates: true }
      )
      .select("id")
      .maybeSingle();

    if (insertedContact) {
      contactId = insertedContact.id;
    } else {
      const { data: existingContact } = await supabase
        .from("contacts")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (!existingContact) throw new Error("Failed to save contact.");
      contactId = existingContact.id;
    }

    const totalPence = paymentAmountPence * groupSize;

    const { data: newBooking, error: bookingError } = await supabase
      .from("bookings")
      .insert([{
        event_id: eventId,
        contact_id: contactId,
        group_name: groupName,
        group_size: groupSize,
        status: isFree ? status : "pending",
        payment_status: isFree ? "paid" : "unpaid",
        special_requests: specialRequests,
        paid_amount: 0,
        total_amount: totalPence / 100,
      }])
      .select("id")
      .single();

    if (bookingError || !newBooking) {
      throw new Error(`Failed to create booking: ${bookingError?.message || "unknown error"}`);
    }

    if (chosenTable) {
      const mapped = await commitMapping(supabase, {
        bookingId: newBooking.id,
        eventId,
        tableId: chosenTable.id,
        groupSize,
      });
      if (!mapped.ok) {
        status = "waitlisted";
        await supabase.from("bookings").update({ status: "waitlisted" }).eq("id", newBooking.id);
      }
    }

    const groupNameRow = groupNameField.visible && groupName.trim()
      ? { label: groupNameField.label, value: groupName.trim() }
      : null;

    if (isFree) {
      await sendEventBookingEmail(
        supabase, newBooking.id, email, fullName, event.title || "Event", event.date, groupSize, status, 0, 0, groupNameRow
      );
      await notifyAdminBookingCreated(newBooking.id);
      await updateFullyBookedStatus(supabase, eventId);
      revalidatePath("/dashboard");
      return { success: true };
    }

    const buyerPhone = buildBuyerPhone(countryCode, phoneNo);

    let checkoutUrl: string | undefined;
    let orderId: string | undefined;
    try {
      const { paymentLink } = await squareClient.checkout.paymentLinks.create({
        idempotencyKey: randomUUID(),
        order: buildEventOrder({
          locationId: process.env.SQUARE_LOCATION_ID!,
          bookingId: newBooking.id,
          eventId: event.id,
          title: event.title || "Event",
          amountPence: paymentAmountPence,
          groupSize,
          fullName,
          email,
          buyerPhone,
        }),
        checkoutOptions: buildCheckoutOptions({
          redirectUrl: `${appUrl}${checkoutReturnPath({ eventId, bookingId: newBooking.id })}`,
          supportEmail: await getContactEmail(),
        }),
        prePopulatedData: buildPrePopulatedData({ email, fullName, buyerPhone }),
      });
      checkoutUrl = paymentLink?.url;
      orderId = paymentLink?.orderId;
    } catch (squareErr) {
      await supabase.from("booking_table_mappings").delete().eq("booking_id", newBooking.id);
      await supabase.from("bookings").delete().eq("id", newBooking.id);

      if (isSquareAuthError(squareErr)) {
        const env = process.env.SQUARE_ENVIRONMENT || "sandbox (default)";
        console.error(
          `[createEventBooking] Square rejected the payment-link request (HTTP ${squareErr.statusCode ?? "?"}, ` +
            `AUTHENTICATION_ERROR). SQUARE_ENVIRONMENT=${env}, SQUARE_LOCATION_ID=${process.env.SQUARE_LOCATION_ID}. ` +
            `If Orders/Payments work but only checkout fails, the Online Checkout API is not enabled for this ` +
            `Square app/test account - enable it (or use a full-capability sandbox test account) in the Square ` +
            `Developer Dashboard. Otherwise verify SQUARE_ACCESS_TOKEN matches SQUARE_ENVIRONMENT and restart the dev server.`
        );
      } else {
        console.error("[createEventBooking] Square payment link error:", squareErr);
      }
      return { error: "We couldn't start checkout. Please try again in a moment." };
    }

    if (!checkoutUrl) {
      await supabase.from("booking_table_mappings").delete().eq("booking_id", newBooking.id);
      await supabase.from("bookings").delete().eq("id", newBooking.id);
      throw new Error("Failed to create payment link. Please try again.");
    }

    await supabase
      .from("bookings")
      .update({ square_order_id: orderId })
      .eq("id", newBooking.id);

    await sendPaymentPendingEmail(supabase, {
      bookingId: newBooking.id,
      eventId,
      email,
      name: fullName,
      eventTitle: event.title || "Event",
      eventDate: event.date,
      groupSize,
      amountDue: totalPence / 100,
    });

    revalidatePath("/dashboard");

    return { checkoutUrl };
  } catch (err) {
    console.error("createEventBooking error:", err);
    return {
      error: err instanceof Error ? err.message : "An unexpected error occurred. Please try again.",
    };
  }
}

async function sendPaymentPendingEmail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  args: {
    bookingId: number;
    eventId: number;
    email: string;
    name: string;
    eventTitle: string;
    eventDate: string;
    groupSize: number;
    amountDue: number;
  }
) {
  const slots = await renderTemplate(
    supabase,
    "booking.payment_pending",
    paymentPendingMergeValues({
      name: args.name,
      eventTitle: args.eventTitle,
      eventDate: args.eventDate,
      groupSize: args.groupSize,
      amountDue: args.amountDue,
    })
  );
  if (!slots) return;

  const { subject, html } = buildPaymentPendingEmail({
    slots,
    eventDate: args.eventDate,
    groupSize: args.groupSize,
    amountDue: args.amountDue,
    payUrl: `${appUrl}${checkoutReturnPath({
      eventId: args.eventId,
      bookingId: args.bookingId,
    })}`,
  });

  try {
    const { error: resendError } = await resend.emails.send({
      from: EMAIL_FROM,
      to: args.email,
      subject,
      html,
    });
    if (resendError) console.error("Resend API Error:", resendError);
  } catch (emailError) {
    console.error("Email failed (non-blocking):", emailError);
  }
}

async function sendEventBookingEmail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bookingId: number,
  email: string,
  name: string,
  eventTitle: string,
  bookingDate: string,
  groupSize: number,
  status: "confirmed" | "waitlisted",
  totalAmount: number | string,
  paidAmount: number | string,
  groupNameRow: { label: string; value: string } | null
) {
  const manageUrl = `${appUrl}/manage-booking/${bookingId}`;
  const partySize = `${groupSize} ${groupSize === 1 ? "Person" : "People"}`;

  const slots = await renderTemplate(
    supabase,
    status === "confirmed" ? "booking.event.confirmed" : "booking.event.waitlisted",
    {
      customerName: name,
      eventTitle,
      eventDate: formatEventDate(bookingDate),
      groupName: groupNameRow?.value ?? "",
      groupSize: partySize,
      bookingId: String(bookingId),
      contactEmail: await getContactEmail(),
    }
  );
  if (!slots) return;

  /* The rows this booking actually has - the money pair only appears once
     something has been charged. */
  const detailRows = [
    { label: "📅 Date", value: format(new Date(`${bookingDate}T00:00:00`), "EEE, d MMM yyyy") },
    ...(groupNameRow ? [{ label: `🏷️ ${groupNameRow.label}`, value: groupNameRow.value }] : []),
    { label: "👥 Tickets", value: partySize },
    ...(Number(totalAmount) > 0
      ? [
          { label: "💷 Total", value: `£${Number(totalAmount).toFixed(2)}` },
          { label: "💳 Paid", value: `£${Number(paidAmount).toFixed(2)}` },
        ]
      : []),
  ];

  const { subject, html } = buildBookingConfirmedEmail({ slots, rows: detailRows, manageUrl });

  try {
    const { error: resendError } = await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject,
      html,
    });
    if (resendError) {
      console.error("Resend API Error:", resendError);
    }
  } catch (emailError) {
    console.error("Email failed (non-blocking):", emailError);
  }
}
