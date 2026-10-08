import { BANNER_CONTENT_TYPE, BANNER_SIZE, bookingBanner } from "@/lib/og/booking-banner";

export const size = BANNER_SIZE;
export const contentType = BANNER_CONTENT_TYPE;
export const alt = "Private hire at Don Fenticas";

export default function Image() {
  return bookingBanner("Private hire at");
}
