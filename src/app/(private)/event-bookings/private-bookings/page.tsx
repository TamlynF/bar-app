import React from "react";
import { createClient } from "@/lib/supabase/server";
import { type PrivateHireRequest } from "./components/private-hire-card";
import PrivateHireListClient from "./components/private-hire-list-client";

export const dynamic = "force-dynamic";

export default async function PrivateBookingsPage() {
  const supabase = await createClient();

  const { data: requests, error } = await supabase
    .from("private_hire_requests")
    .select("*, event_subtypes:event_subtypes_id ( id, name, default_event_title, event_types_id ), updated_by_employee:employees!private_hire_requests_updated_by_fkey ( full_name ), linked_event:events!private_hire_requests_event_id_fkey ( is_active, date, start_time, end_time )")
    .order("created_at", { ascending: false });

  if (error) console.error("Private hire fetch error:", error);

  const items = (requests ?? []) as PrivateHireRequest[];

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-4 sm:py-0 md:px-8">
      <PrivateHireListClient initialRequests={items} />
    </div>
  );
}
