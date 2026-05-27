import React from "react";
import { createClient } from "@/lib/supabase/server";
import { PrivateHireCard, PrivateHireRequest } from "./components/private-hire-card";
import { Building2, Clock, CheckCircle, XCircle } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "pending_review", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "rejected", label: "Rejected" },
];

export default async function PrivateBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: filterStatus = "all" } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("private_hire_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (filterStatus !== "all") {
    query = query.eq("status", filterStatus);
  }

  const { data: requests, error } = await query;
  if (error) console.error("Private hire fetch error:", error);

  const items = (requests ?? []) as PrivateHireRequest[];

  const counts = {
    pending: items.filter((r) => r.status === "pending_review").length,
    confirmed: items.filter((r) => r.status === "confirmed").length,
    rejected: items.filter((r) => r.status === "rejected").length,
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-[#1F1F1A] uppercase tracking-tight">Private Hire</h2>
          <p className="text-xs text-[#5F624F] mt-0.5">Review and respond to venue hire enquiries</p>
        </div>

        <div className="flex flex-wrap gap-2 ml-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full text-[10px] font-black uppercase tracking-wider text-amber-700">
            <Clock className="w-3 h-3" /> {counts.pending} Pending
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full text-[10px] font-black uppercase tracking-wider text-green-700">
            <CheckCircle className="w-3 h-3" /> {counts.confirmed} Confirmed
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 rounded-full text-[10px] font-black uppercase tracking-wider text-red-700">
            <XCircle className="w-3 h-3" /> {counts.rejected} Rejected
          </span>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <a
            key={f.value}
            href={`?status=${f.value}`}
            className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${
              filterStatus === f.value
                ? "bg-[#5C4033] text-white"
                : "bg-white border border-[#E6DFC8] text-[#5F624F] hover:border-[#5C4033]/20"
            }`}
          >
            {f.label}
          </a>
        ))}
      </div>

      {/* Cards */}
      {items.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-[#E6DFC8]">
          <Building2 className="w-10 h-10 text-[#E6DFC8] mx-auto mb-3" />
          <p className="text-[#5F624F] font-bold text-sm">No private hire enquiries found</p>
          <p className="text-[#5F624F] text-xs mt-1 opacity-60">Enquiries will appear here once guests apply</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((req) => (
            <PrivateHireCard key={req.id} request={req} />
          ))}
        </div>
      )}
    </div>
  );
}
