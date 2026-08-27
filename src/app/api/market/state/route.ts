import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readMarketState } from "@/lib/market/tick";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const sinceParam = req.nextUrl.searchParams.get("since");
  const since = sinceParam != null && /^\d+$/.test(sinceParam) ? Number(sinceParam) : null;

  const supabase = createAdminClient();
  const state = await readMarketState(supabase, since);
  return NextResponse.json(state, {
    headers: { "cache-control": "no-store" },
  });
}
