import { createClient } from "@/lib/supabase/server";
import type { EmailTemplateRow } from "@/lib/email/merge";
import { brandFromRow, type EmailBrandRow } from "@/lib/email/design";
import { sanitizeBookingEmailChoices } from "@/lib/email/booking-email-versions";
import EmailTemplatesClient from "./email-templates-client";

export const metadata = {
  title: "Email templates",
};

type ChoiceRow = { id: number; booking_emails: unknown };

function addUsage(
  usage: Record<number, string[]>,
  rows: ChoiceRow[] | null,
  label: (row: ChoiceRow) => string
) {
  for (const row of rows ?? []) {
    for (const versionId of new Set(Object.values(sanitizeBookingEmailChoices(row.booking_emails)))) {
      (usage[versionId] ??= []).push(label(row));
    }
  }
}

export default async function EmailTemplatesPage() {
  const supabase = await createClient();

  const [
    { data: rows },
    { data: employees },
    { data: brandRow },
    { data: types },
    { data: subtypes },
    { data: events },
  ] = await Promise.all([
    supabase.from("email_templates").select("*"),
    supabase.from("employees").select("id, full_name").order("full_name", { ascending: true }),
    supabase.from("email_brand").select("*").eq("id", 1).maybeSingle(),
    supabase.from("event_types").select("id, name, booking_emails").not("booking_emails", "is", null),
    supabase.from("event_subtypes").select("id, name, booking_emails").not("booking_emails", "is", null),
    supabase
      .from("events")
      .select("id, title, date, booking_emails")
      .not("booking_emails", "is", null)
      .order("date", { ascending: true }),
  ]);

  const usage: Record<number, string[]> = {};
  addUsage(usage, types as ChoiceRow[] | null, (r) => `Category: ${(r as ChoiceRow & { name: string }).name}`);
  addUsage(usage, subtypes as ChoiceRow[] | null, (r) => `Sub-category: ${(r as ChoiceRow & { name: string }).name}`);
  addUsage(usage, events as ChoiceRow[] | null, (r) => {
    const event = r as ChoiceRow & { title: string | null; date: string };
    return `Event: ${event.title || "Untitled"} (${event.date})`;
  });

  return (
    <EmailTemplatesClient
      rows={(rows ?? []) as EmailTemplateRow[]}
      employees={employees ?? []}
      brand={brandFromRow((brandRow as EmailBrandRow | null) ?? null)}
      brandUpdatedAt={(brandRow as EmailBrandRow | null)?.updated_at ?? null}
      versionUsage={usage}
    />
  );
}
