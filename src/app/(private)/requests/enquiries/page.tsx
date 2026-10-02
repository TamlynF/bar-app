import React from "react";
import { createClient } from "@/lib/supabase/server";
import { getEnquiries } from "./actions";
import EnquiriesClient, { type Enquiry } from "./components/enquiries-client";

export const dynamic = "force-dynamic";

export default async function EnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const supabase = await createClient();
  const [rows, { data: unreadRows }] = await Promise.all([
    getEnquiries(),
    supabase
      .from("email_messages")
      .select("enquiry_id")
      .eq("direction", "inbound")
      .is("read_at", null)
      .not("enquiry_id", "is", null),
  ]);
  const unreadByEnquiry = new Map<string, number>();
  for (const r of unreadRows ?? []) {
    const id = r.enquiry_id as string;
    unreadByEnquiry.set(id, (unreadByEnquiry.get(id) ?? 0) + 1);
  }
  const enquiries = (rows as Enquiry[]).map((e) => ({ ...e, unread_emails: unreadByEnquiry.get(e.id) ?? 0 }));

  return (
    <div className="p-2 sm:p-0">
      <EnquiriesClient initialEnquiries={enquiries} initialStatus={status} />
    </div>
  );
}