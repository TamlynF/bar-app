import { BANNER_CONTENT_TYPE, BANNER_SIZE, bookingBanner } from "@/lib/og/booking-banner";
import { eventHeading } from "./heading";

export const size = BANNER_SIZE;
export const contentType = BANNER_CONTENT_TYPE;
export const alt = "Book your spot at Don Fenticas";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return bookingBanner(`${(await eventHeading(id)).title} at`);
}
