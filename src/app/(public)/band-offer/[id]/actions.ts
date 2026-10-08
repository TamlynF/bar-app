"use server";

import { Resend } from "resend";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { bandOfferPagePath, respondAsAct, type ActResponse, type BandFlowContext } from "@/lib/band-flow";

const resend = new Resend(process.env.RESEND_API_KEY);

/* The act has no login - the request's unguessable id in the link is their
   key, the same as the private hire page. Every answer re-checks the status,
   so an old link can't act twice. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function context(): BandFlowContext {
  return { supabase: createAdminClient(), resend, actorId: null };
}

export async function respondToOfferAction(
  id: string,
  response: ActResponse,
  message?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!UUID.test(id)) return { ok: false, error: "We couldn't find that offer." };
  const result = await respondAsAct(context(), id, response, message);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath(bandOfferPagePath(id));
  revalidatePath("/event-bookings/music-bookings");
  revalidatePath("/dashboard");
  revalidatePath("/event-setups/events");
  revalidatePath("/");
  return { ok: true };
}
