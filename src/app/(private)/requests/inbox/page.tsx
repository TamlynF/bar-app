import { createClient } from "@/lib/supabase/server";
import { loadInboxThreads } from "@/lib/inbox";
import InboxClient from "./inbox-client";

export const dynamic = "force-dynamic";

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const [{ t }, supabase] = await Promise.all([searchParams, createClient()]);
  const threads = await loadInboxThreads(supabase);
  return <InboxClient threads={threads} initialKey={t ?? null} />;
}
