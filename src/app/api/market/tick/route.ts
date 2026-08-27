import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { maybeRunMarketTick, type MarketSessionRow } from "@/lib/market/tick";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
  const supabase = createAdminClient();
  const { data: session } = await supabase
    .from("market_sessions")
    .select("*")
    .eq("status", "live")
    .maybeSingle();
  if (!session) {
    return NextResponse.json({ status: "closed" });
  }
  await maybeRunMarketTick(supabase, session as MarketSessionRow);
  return NextResponse.json({ status: "live" });
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
