import { BANNER_CONTENT_TYPE, BANNER_SIZE, bookingBanner } from "@/lib/og/booking-banner";
import { bookingGroupHeading } from "./heading";

export const size = BANNER_SIZE;
export const contentType = BANNER_CONTENT_TYPE;
export const alt = "Book a night at Don Fenticas";

export default async function Image({ params }: { params: Promise<{ scope: string; id: string }> }) {
  const { scope, id } = await params;
  return bookingBanner(`${await bookingGroupHeading(scope, id)} at`);
}
