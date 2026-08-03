import { redirect } from "next/navigation";
import { SCHEDULE_HREF } from "@/lib/admin-nav";

export default function EventSetupsBasePage() {
  redirect(SCHEDULE_HREF);
}
