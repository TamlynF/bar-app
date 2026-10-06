import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { runDepositDeadlines } from "@/lib/private-hire-flow";

/* Daily private hire deposit run (Vercel cron, 07:00 UTC): reminds customers
   two days before their deposit is due and releases the date once it has
   passed unpaid. Re-running is harmless - a reminder is sent once per request
   and an expired request is already closed. A manual call needs Bearer
   CRON_SECRET. */

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  const manual = Boolean(secret) && req.headers.get("authorization") === `Bearer ${secret}`;
  return manual || isVercelCron;
}

async function run(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await runDepositDeadlines({
      supabase: createAdminClient(),
      resend: new Resend(process.env.RESEND_API_KEY),
      actorId: null,
    });
    if (result.failed.length) console.error("Private hire deposit run failed for:", result.failed);
    return NextResponse.json(result, { status: result.failed.length ? 500 : 200 });
  } catch (e) {
    console.error("Private hire deposit run failed:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Run failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
