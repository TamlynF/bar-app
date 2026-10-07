import type { Metadata } from "next";
import { MessageSquareOff } from "lucide-react";
import { PublicNav } from "@/components/public-nav";
import { ArrowCta } from "@/components/ui/arrow-cta";
import { createAdminClient } from "@/lib/supabase/admin";
import { stopSmsByCode } from "@/lib/market/sms-alerts";

export const metadata: Metadata = {
  title: "Stop Market Night texts",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/* The "Stop texts" link in every alert lands here, so a phone can switch its
   texts off even when the sender is an alphanumeric name that can't take a
   STOP reply. */
export default async function MarketStopTextsPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const done = await stopSmsByCode(createAdminClient(), t);

  return (
    <main className="flex min-h-dvh w-full flex-col bg-[#1a2008] text-white antialiased">
      <PublicNav currentPath="/market" />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <MessageSquareOff className="h-10 w-10 text-stone-500" aria-hidden="true" />
        <h1 className="mt-4 text-h3 font-black tracking-tighter text-ink uppercase">
          {done ? "Texts off" : "That link didn't work"}
        </h1>
        <p className="mt-3 text-body text-stone-400">
          {done
            ? "No more Market Night texts to this phone. You can turn them back on any time from the market page."
            : "The link may be old or already used. Open the market page and turn texts off from there instead."}
        </p>
        <ArrowCta href="/market" variant="goldOutline" size="sm" className="mt-6 rounded-full">
          Back to the market
        </ArrowCta>
      </div>
    </main>
  );
}
