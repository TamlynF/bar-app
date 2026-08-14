import { createClient } from "@/lib/supabase/server";
import type { EmailTemplateRow } from "@/lib/email/merge";
import EmailTemplatesClient from "./email-templates-client";

export const metadata = {
  title: "Email templates | Don Fenticas",
};

export default async function EmailTemplatesPage() {
  const supabase = await createClient();

  const [{ data: rows }, { data: employees }] = await Promise.all([
    supabase.from("email_templates").select("*"),
    supabase.from("employees").select("id, full_name").order("full_name", { ascending: true }),
  ]);

  return (
    <EmailTemplatesClient
      rows={(rows ?? []) as EmailTemplateRow[]}
      employees={employees ?? []}
    />
  );
}
