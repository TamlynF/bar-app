import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshTrends } from "@/app/(private)/marketing/lib/refresh-trends";
import type { TrendKind } from "@/app/(private)/marketing/lib/types";

/* Scheduled Trends Hub refresh. Same auth pattern as /api/square/sync:
   Vercel cron sets x-vercel-cron; a manual call needs Bearer CRON_SECRET.
   Schedules live in vercel.json: ads Mon+Thu, events Mon, prices 1st of month.
   `kind` comes from the query string; omit it to run ads + events together. */

export const dynamic = "force-dynamic";
export const maxDuration = 120; // two AI web-search calls can take a while

const KINDS: TrendKind[] = ["advertising", "event_idea", "price"];

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  if (!secret) return isVercelCron;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}` || isVercelCron;
}

async function run(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = req.nextUrl.searchParams.get("kind");
  const kind = KINDS.find((k) => k === raw);
  if (raw && !kind) {
    return NextResponse.json({ error: `Unknown kind "${raw}"` }, { status: 400 });
  }

  // Service-role client: no cookies on a cron, and RLS would otherwise block the
  // upsert. created_by is null for scheduled runs, which is how the card shows
  // it was found by the schedule rather than a person.
  const supabase = createAdminClient();
  const result = await refreshTrends(supabase, null, kind);

  if ("error" in result) {
    console.error("Scheduled trends refresh failed:", result.error);
    return NextResponse.json(result, { status: 500 });
  }
  revalidatePath("/marketing/trends");
  return NextResponse.json({ ...result, kind: kind ?? "advertising+event_idea" });
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
