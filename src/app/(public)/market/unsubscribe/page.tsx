import type { Metadata } from "next";
import { MailX } from "lucide-react";
import { PublicNav } from "@/components/public-nav";
import { ArrowCta } from "@/components/ui/arrow-cta";
import { createAdminClient } from "@/lib/supabase/admin";
import { optOutEmailSubscription } from "@/lib/market/email-alerts";

export const metadata: Metadata = {
  title: "Unsubscribe from Market Night emails",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function MarketUnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; t?: string }>;
}) {
  const { e, t } = await searchParams;
  const done = await optOutEmailSubscription(createAdminClient(), e, t);

  return (
    <main className="flex min-h-dvh w-full flex-col bg-[#1a2008] text-white antialiased">
      <PublicNav currentPath="/market" />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <MailX className="h-10 w-10 text-stone-500" aria-hidden="true" />
        <h1 className="mt-4 text-h3 font-black tracking-tighter text-ink uppercase">
          {done ? "You're unsubscribed" : "That link didn't work"}
        </h1>
        <p className="mt-3 text-body text-stone-400">
          {done
            ? "No more Market Night emails to this address. You can sign up again any time from the market page."
            : "The link may be old or already used. Open the market page and turn emails off from there instead."}
        </p>
        <ArrowCta href="/market" variant="goldOutline" size="sm" className="mt-6 rounded-full">
          Back to the market
        </ArrowCta>
      </div>
    </main>
  );
}
