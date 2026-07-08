// Scheduled Square → Supabase sales sync.
//
// This is an API route (not a Server Action) because it's a scheduled,
// unauthenticated third-party pull — the same class of exception as the Square
// payment webhook. Triggered by Vercel Cron (see vercel.json). It uses the
// admin/service-role client since there's no user session.
//
// Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. We also allow
// Vercel's own cron header. Manual runs must supply the same bearer token.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncSquareSales } from "@/lib/square-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // Vercel Cron requests carry this header; treat as trusted if no secret set.
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  if (!secret) return isVercelCron;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}` || isVercelCron;
}

async function run(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createAdminClient();
  const result = await syncSquareSales(supabase);
  const status = result.status === "ok" ? 200 : 500;
  return NextResponse.json(result, { status });
}

export async function GET(req: NextRequest) {
  return run(req);
}

// POST supported too, for manual triggering from scripts/tools.
export async function POST(req: NextRequest) {
  return run(req);
}
