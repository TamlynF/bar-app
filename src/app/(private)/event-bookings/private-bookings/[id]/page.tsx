import { redirect } from "next/navigation";

/* Requests are managed in the sheet on the list page; old links land there. */
export default async function PrivateHireRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/event-bookings/private-bookings?open=${encodeURIComponent(id)}`);
}
