import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendDueInvoiceRequests } from "@/lib/band-invoice-requests";
import { venueHourAndDay } from "@/lib/band-invoice";

/* Monday 9am invoice requests to acts that played in the last week. Vercel
   cron runs in UTC, so vercel.json calls this at 08:00 and 09:00 UTC every
   Monday and only the call that lands at 9am London time sends - that covers
   both GMT and BST. A manual call with Bearer CRON_SECRET always runs; repeats
   are harmless because an act that already has one in its thread is skipped. */

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function isAuthorized(req: NextRequest): { ok: boolean; manual: boolean } {
  const secret = process.env.CRON_SECRET;
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  const manual = Boolean(secret) && req.headers.get("authorization") === `Bearer ${secret}`;
  return { ok: manual || isVercelCron, manual };
}

async function run(req: NextRequest) {
  const auth = isAuthorized(req);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const { hour, weekday } = venueHourAndDay(now);
  if (!auth.manual && (weekday !== "Mon" || hour !== 9)) {
    return NextResponse.json({ skipped: `Not 9am Monday in London (${weekday} ${hour}:00)` });
  }

  try {
    const result = await sendDueInvoiceRequests(createAdminClient(), now);
    if (result.failed.length) console.error("Invoice requests failed:", result.failed);
    return NextResponse.json(result, { status: result.failed.length ? 500 : 200 });
  } catch (e) {
    console.error("Invoice request run failed:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Run failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
