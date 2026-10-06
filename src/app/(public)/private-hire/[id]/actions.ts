"use server";

import { Resend } from "resend";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  depositCheckoutUrl,
  respondAsCustomer,
  type CustomerResponse,
  type FlowContext,
} from "@/lib/private-hire-flow";

const resend = new Resend(process.env.RESEND_API_KEY);

/* The customer has no login - the request's unguessable id in the link is
   their key, the same as manage-booking. Every step re-checks the status, so
   an old link can't act twice. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function context(): FlowContext {
  return { supabase: createAdminClient(), resend, actorId: null };
}

function refresh(id: string) {
  revalidatePath(`/private-hire/${id}`);
  revalidatePath("/event-bookings/private-bookings");
  revalidatePath("/dashboard");
}

export async function respondToHireAction(
  id: string,
  response: CustomerResponse,
  message?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!UUID.test(id)) return { ok: false, error: "We couldn't find that request." };
  const result = await respondAsCustomer(context(), id, response, message);
  if (!result.ok) return { ok: false, error: result.error };
  refresh(id);
  return { ok: true };
}

export async function startDepositPaymentAction(id: string): Promise<{ url: string } | { error: string }> {
  if (!UUID.test(id)) return { error: "We couldn't find that request." };
  return depositCheckoutUrl(context(), id);
}
