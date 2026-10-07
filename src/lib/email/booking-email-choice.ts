import type { SupabaseClient } from "@supabase/supabase-js";
import { renderTemplate } from "./resolve";
import type { MergeValues } from "./render";
import type { RenderedSlots } from "./design";
import {
  bookingEmailSlot,
  resolveBookingEmailChoice,
  type ChoiceLevels,
  type EmailVersion,
} from "./booking-email-versions";

type ChoiceRel = { booking_emails: unknown };

function unwrap<T>(rel: T | T[] | null | undefined): T | null {
  if (Array.isArray(rel)) return rel[0] ?? null;
  return rel ?? null;
}

export function emailLevelsFromEvent(event: {
  booking_emails?: unknown;
  event_types?: ChoiceRel | ChoiceRel[] | null;
  event_subtypes?: ChoiceRel | ChoiceRel[] | null;
} | null): ChoiceLevels {
  return {
    event: event?.booking_emails,
    subtype: unwrap(event?.event_subtypes)?.booking_emails,
    type: unwrap(event?.event_types)?.booking_emails,
  };
}

export async function loadEventEmailLevels(
  supabase: SupabaseClient,
  eventId: number | string | null | undefined
): Promise<ChoiceLevels> {
  if (eventId == null) return {};
  const { data, error } = await supabase
    .from("events")
    .select("booking_emails, event_types(booking_emails), event_subtypes(booking_emails)")
    .eq("id", eventId)
    .maybeSingle();
  if (error) console.error("[booking emails] could not read the event's email choices:", error.message);
  return emailLevelsFromEvent(data as Parameters<typeof emailLevelsFromEvent>[0]);
}

export function versionFor(key: string, levels: ChoiceLevels): number | null {
  const slot = bookingEmailSlot(key);
  if (!slot) return null;
  return resolveBookingEmailChoice(slot, levels)?.versionId || null;
}

export async function renderBookingTemplate(
  supabase: SupabaseClient,
  key: string,
  eventId: number | string | null | undefined,
  values: MergeValues
): Promise<RenderedSlots | null> {
  const levels = await loadEventEmailLevels(supabase, eventId);
  return renderTemplate(supabase, key, values, versionFor(key, levels));
}

export async function loadEmailVersions(supabase: SupabaseClient): Promise<EmailVersion[]> {
  const { data, error } = await supabase
    .from("email_templates")
    .select("id, scenario_key, variant_name")
    .not("variant_name", "is", null)
    .order("variant_name", { ascending: true });
  if (error) console.error("[booking emails] could not read email versions:", error.message);
  return (data ?? []).map((row) => ({
    id: row.id as number,
    scenarioKey: row.scenario_key as string,
    name: row.variant_name as string,
  }));
}
