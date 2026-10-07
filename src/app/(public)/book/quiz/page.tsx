import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { quizBookingHref } from "@/lib/quiz-booking-link";

export const dynamic = "force-dynamic";

export default async function QuizBookingRedirect() {
  const supabase = await createClient();
  redirect((await quizBookingHref(supabase)) ?? "/book");
}
