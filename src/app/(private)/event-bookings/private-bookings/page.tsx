import React from "react";
import { createClient } from "@/lib/supabase/server";
import { type PrivateHireRequest } from "./components/private-hire-card";
import PrivateHireListClient from "./components/private-hire-list-client";

export const dynamic = "force-dynamic";

export default async function PrivateBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const initialStatuses = status
    ? status.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
    : [];
  const supabase = await createClient();

  const unreadPromise = supabase
    .from("email_messages")
    .select("private_hire_request_id")
    .eq("direction", "inbound")
    .is("read_at", null)
    .not("private_hire_request_id", "is", null);

  const { data: requests, error } = await supabase
    .from("private_hire_requests")
    .select("*, event_subtypes:event_subtypes_id ( id, name, default_event_title, event_types_id ), updated_by_employee:employees!private_hire_requests_updated_by_fkey ( full_name ), linked_event:events!private_hire_requests_event_id_fkey ( is_active, date, start_time, end_time ), internal_notes:private_hire_notes ( id, body, created_at, author:employees!private_hire_notes_created_by_fkey ( full_name ) )")
    .order("created_at", { ascending: false })
    .order("created_at", { referencedTable: "private_hire_notes", ascending: true });

  if (error) console.error("Private hire fetch error:", error);

  const { data: unreadRows } = await unreadPromise;
  const unreadByRequest = new Map<string, number>();
  for (const r of unreadRows ?? []) {
    const id = r.private_hire_request_id as string;
    unreadByRequest.set(id, (unreadByRequest.get(id) ?? 0) + 1);
  }

  const items = ((requests ?? []) as PrivateHireRequest[]).map((r) => ({
    ...r,
    unread_emails: unreadByRequest.get(r.id) ?? 0,
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-3 py-4 sm:py-0 md:px-4 xl:max-w-none">
      <PrivateHireListClient initialRequests={items} initialStatuses={initialStatuses} />
    </div>
  );
}
