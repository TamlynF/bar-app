import React from "react";
import { getEnquiries } from "./actions";
import EnquiriesClient, { type Enquiry } from "./components/enquiries-client";

export const dynamic = "force-dynamic";

export default async function EnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const enquiries = (await getEnquiries()) as Enquiry[];

  return (
    <div className="p-2 sm:p-0">
      <EnquiriesClient initialEnquiries={enquiries} initialStatus={status} />
    </div>
  );
}