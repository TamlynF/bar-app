import Link from "next/link";
import type { Metadata } from "next";
import { MonitorPlay } from "lucide-react";
import { PublicNav } from "@/components/public-nav";
import { PageHeader } from "@/components/editorial/page-header";
import MarketFeed from "./market-feed";

/* iOS bakes the manifest and app title into the home-screen icon at install
   time, so this page advertises its own manifest: the icon a guest adds from
   here is called "Market Night" and opens /market, not the site home page. */
export const metadata: Metadata = {
  title: "Market Night",
  description:
    "The drinks menu turns into a live stock market - prices rise and fall all night with what people are drinking.",
  manifest: "/market-manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Market Night",
  },
};

export default function MarketPage() {
  return (
    <main className="flex min-h-dvh w-full flex-col bg-[#1a2008] text-white antialiased selection:bg-[#FDCC4B] selection:text-[#1a2008]">
      <style
        dangerouslySetInnerHTML={{
          __html: `html, body { background-color: #1a2008 !important; margin: 0; padding: 0; overflow-x: hidden; }`,
        }}
      />

      <PublicNav currentPath="/market" />

      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        <PageHeader
          eyebrow="Live from the bar"
          title="Market Night"
          tone="live"
          subtitle={
            <>
              <span className="sm:hidden">The board price is the bar price.</span>
              <span className="hidden sm:inline">
                Prices move with what people are drinking. The board price is the bar price.
              </span>
            </>
          }
        />
        <MarketFeed />
        <div className="mt-10 flex justify-center">
          <Link
            href="/market/board"
            className="inline-flex min-h-11 items-center gap-2 font-black text-[10px] tracking-widest text-stone-400 uppercase transition-colors hover:text-white"
          >
            <MonitorPlay className="h-4 w-4" aria-hidden="true" />
            Big screen view
          </Link>
        </div>
      </div>
    </main>
  );
}
