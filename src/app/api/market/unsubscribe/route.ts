import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { optOutEmailSubscription } from "@/lib/market/email-alerts";

export const dynamic = "force-dynamic";

/* RFC 8058 one-click unsubscribe: mail apps POST to the List-Unsubscribe URL
   with no user interaction, so this answers 200 whether or not the row was
   found and never renders anything. People clicking the link in the email
   body land on /market/unsubscribe instead. */
export async function POST(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("e");
  const token = req.nextUrl.searchParams.get("t");
  await optOutEmailSubscription(createAdminClient(), email, token);
  return new NextResponse(null, { status: 200 });
}
