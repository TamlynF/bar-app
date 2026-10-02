import { createClient } from "@/lib/supabase/server";
import type { EmailTemplateRow } from "@/lib/email/merge";
import { brandFromRow, type EmailBrandRow } from "@/lib/email/design";
import EmailTemplatesClient from "./email-templates-client";

export const metadata = {
  title: "Email templates",
};

export default async function EmailTemplatesPage() {
  const supabase = await createClient();

  const [{ data: rows }, { data: employees }, { data: brandRow }] = await Promise.all([
    supabase.from("email_templates").select("*"),
    supabase.from("employees").select("id, full_name").order("full_name", { ascending: true }),
    supabase.from("email_brand").select("*").eq("id", 1).maybeSingle(),
  ]);

  return (
    <EmailTemplatesClient
      rows={(rows ?? []) as EmailTemplateRow[]}
      employees={employees ?? []}
      brand={brandFromRow((brandRow as EmailBrandRow | null) ?? null)}
      brandUpdatedAt={(brandRow as EmailBrandRow | null)?.updated_at ?? null}
    />
  );
}
