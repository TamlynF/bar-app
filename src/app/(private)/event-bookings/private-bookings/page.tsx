import React from "react";
import { createClient } from "@/lib/supabase/server";
import { type PrivateHireRequest } from "./components/private-hire-card";
import PrivateHireListClient from "./components/private-hire-list-client";

export const dynamic = "force-dynamic";

export default async function PrivateBookingsPage() {
  const supabase = await createClient();

  const { data: requests, error } = await supabase
    .from("private_hire_requests")
    .select("*, event_subtypes:event_subtypes_id ( id, name, default_event_title, event_types_id ), updated_by_employee:employees!private_hire_requests_updated_by_fkey ( full_name )")
    .order("created_at", { ascending: false });

  if (error) console.error("Private hire fetch error:", error);

  const items = (requests ?? []) as PrivateHireRequest[];

  return (
    <div className="px-4 py-4 md:px-8 sm:py-0 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-black text-[#1F1F1A] uppercase tracking-tight">
          Private Hire
        </h2>
        <p className="text-xs text-[#5F624F] mt-0.5">
          Review and respond to venue hire enquiries
        </p>
      </div>

      <PrivateHireListClient initialRequests={items} />
    </div>
  );
}
